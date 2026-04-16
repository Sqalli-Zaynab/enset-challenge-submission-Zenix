import { generateChatCompletion } from "./groq.service.js";
import {
  finalizeStudentProfile,
  mergeStudentProfile,
  sanitizeProfileUpdates,
} from "./student-profiler.service.js";
import { evaluateInterviewReadiness } from "./readiness.service.js";
import { getFallbackQuestion } from "./question-strategy.service.js";

function safeParseJson(text) {
  if (!text || typeof text !== "string") return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // ignore
    }
  }
   const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sanitizeConfidenceMap(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const out = {};

  for (const [key, val] of Object.entries(raw)) {
    const n = Number(val);
    if (Number.isFinite(n)) {
      out[key] = Math.max(0, Math.min(1, n));
    }
  }
  return out;
}

function getConversationWindow(messages = [], limit = 10) {
  return messages.slice(-limit).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export async function runInterviewTurn({ messages = [], currentProfile = {} }) {
  const current = finalizeStudentProfile(currentProfile || {});
  const currentReadiness = evaluateInterviewReadiness(current);
 const systemPrompt = `
You are Zenix, an empathic but rigorous Moroccan university and career orientation interviewer.
Your job is NOT to jump quickly to schools.
Your job is to understand the student deeply before planning.

You must reason about these dimensions:
- fieldOfInterest
- careerGoal
- academicLevel
- academicAverage
- academicConfidence (1-5)
- psychologicalReadiness (1-5)
- familySupport (1-5)
- mobility (1-5)
- riskTolerance (1-5)
- preferredRegion
- preferredLanguage
- institutionType
- budgetMAD
- financialAidNeeded (true/false)
- workWhileStudying (true/false)
- needsFlexibleSchedule (true/false)
- accessibilityNeeds (true/false)
- strengths (array)
- interests (array)
- constraints (array)

Rules:
- Ask ONE best next question only.
- Prefer the most informative question.
- Do not ask generic repeated questions.
- If the student has not shared psychological, family, risk, mobility or budget info, actively try to discover them.
- Keep the question natural, short, and conversational.
- Return ONLY valid JSON.

JSON schema:
{
  "profileUpdates": {
    "fieldOfInterest": null,
    "careerGoal": null,
    "academicLevel": null,
    "academicAverage": null,
    "academicConfidence": null,
    "psychologicalReadiness": null,
    "familySupport": null,
    "mobility": null,
    "riskTolerance": null,
    "preferredRegion": null,
    "preferredLanguage": null,
    "institutionType": null,
    "budgetMAD": null,
    "financialAidNeeded": null,
    "workWhileStudying": null,
    "needsFlexibleSchedule": null,
    "accessibilityNeeds": null,
    "strengths": [],
    "interests": [],
    "constraints": [],
    "evidence": {}
  },
  "confidenceByDimension": {
    "fieldOfInterest": 0.9
  },
  "detectedSignals": ["string"],
  "reasoningSummary": "string",
  "nextQuestion": "string"
}
`;

  const userPrompt = `
Current profile:
${JSON.stringify(current, null, 2)}
Current readiness:
${JSON.stringify(currentReadiness, null, 2)}

Conversation history:
${JSON.stringify(getConversationWindow(messages), null, 2)}
`;

  const raw = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.2, max_tokens: 1600 },
  );

  const parsed = safeParseJson(raw);
  const parsedUpdates = sanitizeProfileUpdates(parsed?.profileUpdates || {});
  const merged = finalizeStudentProfile(mergeStudentProfile(current, parsedUpdates));
  const readiness = evaluateInterviewReadiness(merged);

  const nextQuestion = readiness.ready
   ? ""
    : typeof parsed?.nextQuestion === "string" && parsed.nextQuestion.trim().length >= 10
      ? parsed.nextQuestion.trim()
      : getFallbackQuestion(merged, readiness);

  return {
    updatedProfile: merged,
    confidenceByDimension: sanitizeConfidenceMap(parsed?.confidenceByDimension || {}),
    detectedSignals: Array.isArray(parsed?.detectedSignals) ? parsed.detectedSignals : [],
    reasoningSummary:
      typeof parsed?.reasoningSummary === "string"
        ? parsed.reasoningSummary
        : `Interview stage: ${readiness.interviewStage}`,
    nextQuestion,
    interviewReady: readiness.ready,
    interviewAssessment: readiness,
  };
}