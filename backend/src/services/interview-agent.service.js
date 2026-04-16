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

function getConversationWindow(messages = [], limit = 8) {
  return messages.slice(-limit).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export async function runInterviewTurn({
  messages = [],
  currentProfile = {},
  questionCount = 0,
  maxQuestions = 10,
}) {
  const current = finalizeStudentProfile(currentProfile || {});
  const currentReadiness = evaluateInterviewReadiness(current, {
    questionCount,
    maxQuestions,
  });

  if (currentReadiness.ready) {
    return {
      updatedProfile: current,
      confidenceByDimension: {},
      detectedSignals: [],
      reasoningSummary: `Quick scan complete: ${currentReadiness.finalizeReason}`,
      nextQuestion: "",
      interviewReady: true,
      interviewAssessment: currentReadiness,
    };
  }

  const systemPrompt = `
You are Zenix, a fast university guidance interviewer.
You must ask ONLY ONE simple question at a time.
Never ask two questions in one prompt.
Never ask intimate or overly technical questions.
The objective is a quick scan, not a deep interview.

Rules:
- Ask one atomic question only.
- Keep it short and practical.
- Use information already known.
- If enough information exists, ask nothing and finalize.
- Return ONLY valid JSON.

Return JSON schema:
{
  "profileUpdates": {
    "fieldOfInterest": null,
    "academicLevel": null,
    "academicAverage": null,
    "academicConfidence": null,
    "preferredRegion": null,
    "preferredLanguage": null,
    "institutionType": null,
    "budgetMAD": null,
    "financialAidNeeded": null,
    "mobility": null,
    "riskTolerance": null,
    "constraints": []
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
Question count so far: ${questionCount}/${maxQuestions}

Current profile:
${JSON.stringify(current, null, 2)}

Current readiness:
${JSON.stringify(currentReadiness, null, 2)}

Recent conversation:
${JSON.stringify(getConversationWindow(messages), null, 2)}
`;

  const raw = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.1, max_tokens: 900 },
  );

  const parsed = safeParseJson(raw);
  const parsedUpdates = sanitizeProfileUpdates(parsed?.profileUpdates || {});
  const merged = finalizeStudentProfile(mergeStudentProfile(current, parsedUpdates));
  const readiness = evaluateInterviewReadiness(merged, {
    questionCount,
    maxQuestions,
  });

  let nextQuestion = "";
  if (!readiness.ready) {
    if (
      typeof parsed?.nextQuestion === "string" &&
      parsed.nextQuestion.trim().length >= 5 &&
      !/[?].*[?]/.test(parsed.nextQuestion.trim()) // crude way to reduce double-question prompts
    ) {
      nextQuestion = parsed.nextQuestion.trim();
    } else {
      nextQuestion = getFallbackQuestion(merged);
    }
  }

  return {
    updatedProfile: merged,
    confidenceByDimension: sanitizeConfidenceMap(parsed?.confidenceByDimension || {}),
    detectedSignals: Array.isArray(parsed?.detectedSignals) ? parsed.detectedSignals : [],
    reasoningSummary:
      typeof parsed?.reasoningSummary === "string"
        ? parsed.reasoningSummary
        : `Quick scan stage: ${readiness.interviewStage}`,
    nextQuestion,
    interviewReady: readiness.ready,
    interviewAssessment: readiness,
  };
}