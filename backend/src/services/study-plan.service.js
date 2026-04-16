import { generateChatCompletion } from "./groq.service.js";

function safeParseJson(text) {
  if (!text) return null;

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

function budgetBand(budgetMAD) {
  if (budgetMAD == null) return "unknown";
  if (budgetMAD <= 15000) return "low";
  if (budgetMAD <= 40000) return "medium";
  return "high";
}

function riskStyle(score) {
  if (score == null) return "balanced";
  if (score <= 2) return "safe";
  if (score >= 4) return "ambitious";
  return "balanced";
}

function fitLabel(score) {
  if (score >= 80) return "excellent_fit";
  if (score >= 65) return "good_fit";
  if (score >= 50) return "possible_fit";
  return "risky_fit";
}

function computeFitScore(profile, source, lane = "balanced") {
  let score = 45;
  const hay = `${source.title} ${source.snippet}`.toLowerCase();

  if (source.official) score += 10;
  if (profile.preferredRegion && hay.includes(String(profile.preferredRegion).toLowerCase())) score += 10;
  if (profile.fieldOfInterest && hay.includes(String(profile.fieldOfInterest).toLowerCase())) score += 12;
  if (profile.preferredLanguage && hay.includes(String(profile.preferredLanguage).toLowerCase())) score += 2;
  if (lane === "safe" && (profile.riskTolerance || 3) <= 2) score += 5;
  if (lane === "ambitious" && (profile.riskTolerance || 3) >= 4) score += 5;

  return Math.max(20, Math.min(95, score));
}

function buildFallbackPlan(profile, sources = [], finalizeReason = null) {
  const lanes = ["safe", "balanced", "ambitious"];
  const schoolSuggestions = sources.slice(0, 6).map((source, index) => {
    const lane = lanes[index % lanes.length];
    const score = computeFitScore(profile, source, lane);

    return {
      rank: index + 1,
      name: source.title,
      program: source.program || profile.fieldOfInterest || "Program to verify",
      city: source.city || profile.preferredRegion || "Morocco",
      url: source.url,
      sourceType: source.sourceType || "web_source",
      official: Boolean(source.official),
      fitScore: score,
      fitLabel: fitLabel(score),
      recommendedLane: lane,
      whyItFits: [
        `Aligned with ${profile.fieldOfInterest || "the declared field"}`,
        profile.preferredRegion
          ? `Relevant to ${profile.preferredRegion}`
          : `Location can be verified`,
      ],
    };
  });

  return {
    summary: "Fast guidance result generated from the quick scan and trusted/web retrieval.",
    completionMode: finalizeReason === "max_questions_reached" ? "partial" : "complete",
    studentSnapshot: {
      fieldOfInterest: profile.fieldOfInterest,
      academicLevel: profile.academicLevel,
      academicAverage: profile.academicAverage,
      academicConfidence: profile.academicConfidence,
      preferredRegion: profile.preferredRegion,
      preferredLanguage: profile.preferredLanguage,
      institutionType: profile.institutionType,
      budgetMAD: profile.budgetMAD,
      budgetBand: budgetBand(profile.budgetMAD),
      riskStyle: riskStyle(profile.riskTolerance),
      mobility: profile.mobility,
    },
    missingFields: Array.isArray(profile.missing) ? profile.missing : [],
    careerDirection: {
      chosenField: profile.fieldOfInterest,
      whyItFits: `This direction is the most coherent with the quick scan profile collected so far.`,
    },
    recommendedPaths: [
      {
        label: "safe",
        title: "Safe path",
        summary: "A lower-risk path with realistic access conditions and stable progression.",
      },
      {
        label: "balanced",
        title: "Balanced path",
        summary: "A strong middle path between ambition, cost, and accessibility.",
      },
      {
        label: "ambitious",
        title: "Ambitious path",
        summary: "A more selective path for stronger profiles or higher ambition.",
      },
    ],
    schools: schoolSuggestions,
    sources: sources.slice(0, 8).map((source) => ({
      title: source.title,
      url: source.url,
      sourceType: source.sourceType || "web_source",
      official: Boolean(source.official),
      qualityScore: source.qualityScore || source.score || 0,
    })),
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}

export async function generateStructuredStudyPlan(profile, sources = [], finalizeReason = null) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return buildFallbackPlan(profile, sources, finalizeReason);
  }

  const prompt = `
You are a fast Moroccan university guidance planner.
Return ONLY valid JSON.
Use ONLY the provided sources.
Do NOT invent universities, links, deadlines, or requirements.
The interview was a quick scan, so your job is to produce a useful result even if some fields are missing.
You must provide:
- a clear student snapshot
- missing fields
- 3 path styles: safe, balanced, ambitious
- compatible schools with links and why they fit

Student profile:
${JSON.stringify(profile, null, 2)}

Finalize reason:
${finalizeReason || "enough_information"}

Sources:
${JSON.stringify(sources, null, 2)}

Required JSON schema:
{
  "summary": "string",
  "completionMode": "partial",
  "studentSnapshot": {
    "fieldOfInterest": "string",
    "academicLevel": "string",
    "academicAverage": 0,
    "academicConfidence": 3,
    "preferredRegion": "string",
    "preferredLanguage": "string",
    "institutionType": "string",
    "budgetMAD": 0,
    "budgetBand": "medium",
    "riskStyle": "balanced",
    "mobility": 3
  },
  "missingFields": ["string"],
  "careerDirection": {
    "chosenField": "string",
    "whyItFits": "string"
  },
  "recommendedPaths": [
    {
      "label": "safe",
      "title": "string",
      "summary": "string"
    }
  ],
  "schools": [
    {
      "rank": 1,
      "name": "string",
      "program": "string",
      "city": "string",
      "url": "string",
      "sourceType": "trusted_source",
      "official": true,
      "fitScore": 80,
      "fitLabel": "good_fit",
      "recommendedLane": "balanced",
      "whyItFits": ["string"]
    }
  ],
  "sources": [
    {
      "title": "string",
      "url": "string",
      "sourceType": "trusted_source",
      "official": true,
      "qualityScore": 7
    }
  ]
}
`;

  const raw = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { temperature: 0.15, max_tokens: 2200 },
  );

  const parsed = safeParseJson(raw);
  if (!parsed) {
    return buildFallbackPlan(profile, sources, finalizeReason);
  }

  return {
    summary: parsed.summary || "Guidance result generated.",
    completionMode:
      parsed.completionMode ||
      (finalizeReason === "max_questions_reached" ? "partial" : "complete"),
    studentSnapshot: parsed.studentSnapshot || {
      fieldOfInterest: profile.fieldOfInterest,
      academicLevel: profile.academicLevel,
      academicAverage: profile.academicAverage,
      academicConfidence: profile.academicConfidence,
      preferredRegion: profile.preferredRegion,
      preferredLanguage: profile.preferredLanguage,
      institutionType: profile.institutionType,
      budgetMAD: profile.budgetMAD,
      budgetBand: budgetBand(profile.budgetMAD),
      riskStyle: riskStyle(profile.riskTolerance),
      mobility: profile.mobility,
    },
    missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : profile.missing || [],
    careerDirection: parsed.careerDirection || {
      chosenField: profile.fieldOfInterest,
      whyItFits: "This direction seems the most coherent with the quick scan profile.",
    },
    recommendedPaths: Array.isArray(parsed.recommendedPaths) ? parsed.recommendedPaths : [],
    schools: Array.isArray(parsed.schools) ? parsed.schools : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    generatedAt: new Date().toISOString(),
    isFallback: false,
  };
}