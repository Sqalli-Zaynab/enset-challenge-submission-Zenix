import { generateChatCompletion } from "./groq.service.js";

function safeParseJson(text) {
  if (!text) return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
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
function fitLabel(score) {
  if (score >= 80) return "excellent_fit";
  if (score >= 65) return "good_fit";
  if (score >= 50) return "possible_fit";
  return "risky_fit";
}

function computeFitScore(profile, source) {
  let score = 45;
  const hay = `${source.title} ${source.snippet}`.toLowerCase();

  if (source.official) score += 10;
  if (profile.preferredRegion && hay.includes(String(profile.preferredRegion).toLowerCase())) score += 10;
  if (profile.fieldOfInterest && hay.includes(String(profile.fieldOfInterest).toLowerCase())) score += 12;
  if ((profile.budgetMAD || 0) >= 30000) score += 5;
  if ((profile.psychologicalReadiness || 3) >= 4) score += 5;
  if ((profile.academicConfidence || 3) >= 4) score += 5;
  if ((profile.mobility || 3) <= 2 && !hay.includes(String(profile.preferredRegion || "").toLowerCase())) score -= 10;

  return Math.max(20, Math.min(95, score));
}
function fallbackPlan(profile, sources = []) {
  const shortlisted = sources.slice(0, 3).map((source, index) => {
    const score = computeFitScore(profile, source);
    return {
      rank: index + 1,
      name: source.title,
      program: profile.fieldOfInterest || "Programme à vérifier",
      location: profile.preferredRegion || "Maroc",
      sourceUrl: source.url,
      official: Boolean(source.official),
      fitScore: score,
      fitLabel: fitLabel(score),
      affordability: profile.budgetMAD && profile.budgetMAD < 20000 ? "check_costs_carefully" : "acceptable_or_unknown",
      psychologicalLoad: (profile.psychologicalReadiness || 3) <= 2 ? "prefer_progressive_path" : "manageable",
      admissionRequirements: [
        "Vérifier les conditions d’admission sur le site officiel",
        "Préparer relevés de notes et diplômes",
        "Contrôler les délais de candidature",
      ],
      riskNotes: [
        "Les informations doivent être confirmées sur le site officiel.",
      ],
        };
  });

  return {
    summary: "Plan généré en mode fallback à partir des meilleures sources disponibles.",
    studentSnapshot: {
      fieldOfInterest: profile.fieldOfInterest,
      academicLevel: profile.academicLevel,
      preferredRegion: profile.preferredRegion,
      budgetMAD: profile.budgetMAD,
      psychologicalReadiness: profile.psychologicalReadiness,
      academicConfidence: profile.academicConfidence,
    },
    recommendedPaths: shortlisted,
    immediateActions: [
      "Sélectionner 2 ou 3 établissements maximum",
      "Vérifier les conditions sur les sites officiels",
      "Préparer les documents administratifs",
      "Construire un calendrier de candidatures",
    ],
    redFlags: [
      "Ne pas se fier uniquement aux résultats web non officiels.",
    ],
      sources: sources.slice(0, 5),
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}

export async function generateStructuredStudyPlan(profile, sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return fallbackPlan(profile, sources);
  }

  const prompt = `
You are a university guidance expert for Moroccan students.
Return ONLY valid JSON.
Use ONLY the sources provided below.
Do not invent schools, costs, or requirements.
If uncertain, explicitly say: "Verify on official website".

Student profile:
${JSON.stringify(profile, null, 2)}
Sources:
${JSON.stringify(sources, null, 2)}

Required JSON schema:
{
  "summary": "string",
  "studentSnapshot": {
    "fieldOfInterest": "string",
    "academicLevel": "string",
    "preferredRegion": "string",
    "budgetMAD": 0,
    "psychologicalReadiness": 3,
    "academicConfidence": 3
  },
   "recommendedPaths": [
    {
      "rank": 1,
      "name": "string",
      "program": "string",
      "location": "string",
      "sourceUrl": "string",
      "official": true,
      "fitScore": 75,
      "fitLabel": "good_fit",
      "affordability": "acceptable_or_unknown",
      "psychologicalLoad": "manageable",
      "admissionRequirements": ["string"],
      "riskNotes": ["string"]
    }
  ],
   "immediateActions": ["string"],
  "redFlags": ["string"],
  "sources": [
    {
      "title": "string",
      "url": "string",
      "official": true,
      "qualityScore": 5
    }
  ]
}
`;

  const raw = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { temperature: 0.15, max_tokens: 2200 },
  );
const parsed = safeParseJson(raw);
  if (!parsed) return fallbackPlan(profile, sources);

  const recommendedPaths = Array.isArray(parsed.recommendedPaths)
    ? parsed.recommendedPaths.map((item, index) => ({
        ...item,
        rank: index + 1,
        fitScore: Number(item.fitScore || 60),
        fitLabel: item.fitLabel || fitLabel(Number(item.fitScore || 60)),
      }))
    : [];

  return {
    summary: parsed.summary || "Plan d’études généré.",
    studentSnapshot: parsed.studentSnapshot || {
      fieldOfInterest: profile.fieldOfInterest,
      academicLevel: profile.academicLevel,
      preferredRegion: profile.preferredRegion,
      budgetMAD: profile.budgetMAD,
      psychologicalReadiness: profile.psychologicalReadiness,
      academicConfidence: profile.academicConfidence,
    },
      recommendedPaths,
    immediateActions: Array.isArray(parsed.immediateActions) ? parsed.immediateActions : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources : sources.slice(0, 5),
    generatedAt: new Date().toISOString(),
    isFallback: false,
  };
}