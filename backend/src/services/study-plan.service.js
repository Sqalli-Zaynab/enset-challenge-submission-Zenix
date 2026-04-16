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
function fitLabel(score) {
  if (score >= 80) return "excellent_fit";
  if (score >= 65) return "good_fit";
  if (score >= 50) return "possible_fit";
  return "risky_fit";
}

function computeFitScore(profile, source, label = "balanced") {
  let score = 45;
  const hay = `${source.title} ${source.snippet}`.toLowerCase();

  if (source.official) score += 10;
  if (profile.preferredRegion && hay.includes(String(profile.preferredRegion).toLowerCase())) score += 10;
  if (profile.fieldOfInterest && hay.includes(String(profile.fieldOfInterest).toLowerCase())) score += 12;
  if ((profile.budgetMAD || 0) >= 30000) score += 5;
  if ((profile.psychologicalReadiness || 0) >= 4) score += 5;
  if ((profile.academicConfidence || 0) >= 4) score += 5;
  if ((profile.mobility || 0) <= 2 && !hay.includes(String(profile.preferredRegion || "").toLowerCase())) score -= 10;
  if (label === "safe" && (profile.riskTolerance || 0) <= 2) score += 6;
  if (label === "ambitious" && (profile.riskTolerance || 0) >= 4) score += 6;

  return Math.max(20, Math.min(95, score));
}
function fallbackPlan(profile, sources = []) {
  const labels = ["balanced", "safe", "ambitious"];
  const shortlisted = sources.slice(0, 3).map((source, index) => {
    const label = labels[index] || "balanced";
    const score = computeFitScore(profile, source, label);

    return {
      rank: index + 1,
      label,
      name: source.title,
      program: profile.fieldOfInterest || "Programme à vérifier",
      location: profile.preferredRegion || "Maroc",
      sourceUrl: source.url,
      official: Boolean(source.official),
      fitScore: score,
      fitLabel: fitLabel(score),
      affordability: profile.budgetMAD && profile.budgetMAD < 20000 ? "check_costs_carefully" : "acceptable_or_unknown",
      psychologicalLoad:
        (profile.psychologicalReadiness || 0) <= 2
          ? "prefer_progressive_path"
          : (profile.psychologicalReadiness || 0) >= 4
            ? "can_handle_high_demand"
            : "manageable",
             fitReasons: [
        `Aligné avec le domaine ${profile.fieldOfInterest || "souhaité"}`,
        `Compatible avec la région ${profile.preferredRegion || "préférée"}`,
      ],
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
    summary:
      "Plan généré en mode fallback à partir des meilleures sources disponibles, avec trois niveaux de recommandation: ambitieux, équilibré et prudent.",
    careerDirection: {
      chosenField: profile.fieldOfInterest,
      whyItFits:
        profile.careerGoal ||
        `Cette direction est cohérente avec tes intérêts déclarés et ta situation actuelle.`,
    },
    studentSnapshot: {
      fieldOfInterest: profile.fieldOfInterest,
      academicLevel: profile.academicLevel,
      academicAverage: profile.academicAverage,
      academicConfidence: profile.academicConfidence,
      psychologicalReadiness: profile.psychologicalReadiness,
      familySupport: profile.familySupport,
      mobility: profile.mobility,
      riskTolerance: profile.riskTolerance,
      preferredRegion: profile.preferredRegion,
      preferredLanguage: profile.preferredLanguage,
      budgetMAD: profile.budgetMAD,
      institutionType: profile.institutionType,
    },
     recommendedPaths: shortlisted,
    immediateActions: [
      "Comparer 2 ou 3 établissements maximum",
      "Vérifier les conditions sur les sites officiels",
      "Préparer les documents administratifs",
      "Construire un calendrier de candidatures",
    ],
    redFlags: [
      "Ne pas se fier uniquement aux résultats non officiels.",
      "Ne pas choisir uniquement par prestige si le budget, le niveau ou la charge psychologique ne suivent pas.",
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
You are a university and career guidance expert for Moroccan students.
Return ONLY valid JSON.
Use ONLY the sources below.
Do NOT invent schools, fees, deadlines, or requirements.
You must produce realistic recommendations, not just prestigious ones.
Consider psychological readiness, academic strength, family support, budget, mobility, and risk tolerance.

Student profile:
${JSON.stringify(profile, null, 2)}

Sources:
${JSON.stringify(sources, null, 2)}
Required JSON schema:
{
  "summary": "string",
  "careerDirection": {
    "chosenField": "string",
    "whyItFits": "string"
  },
  "studentSnapshot": {
    "fieldOfInterest": "string",
    "academicLevel": "string",
    "academicAverage": 0,
    "academicConfidence": 3,
    "psychologicalReadiness": 3,
    "familySupport": 3,
    "mobility": 3,
    "riskTolerance": 3,
    "preferredRegion": "string",
    "preferredLanguage": "string",
    "budgetMAD": 0,
    "institutionType": "string"
  },
   "recommendedPaths": [
    {
      "rank": 1,
      "label": "balanced",
      "name": "string",
      "program": "string",
      "location": "string",
      "sourceUrl": "string",
      "official": true,
      "fitScore": 75,
      "fitLabel": "good_fit",
      "affordability": "acceptable_or_unknown",
      "psychologicalLoad": "manageable",
      "fitReasons": ["string"],
      "admissionRequirements": ["string"],
      "riskNotes": ["string"]
    }
  ],
  "immediateActions": ["string"],
  "redFlags": ["string"],
  "sources": [
    { "title": "string",
      "url": "string",
      "official": true,
      "qualityScore": 5
    }
  ]
}
`;

  const raw = await generateChatCompletion(
    [{ role: "user", content: prompt }],
    { temperature: 0.15, max_tokens: 2400 },
  );

  const parsed = safeParseJson(raw);
  if (!parsed) {
    return fallbackPlan(profile, sources);
  }
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
    careerDirection: parsed.careerDirection || {
      chosenField: profile.fieldOfInterest,
      whyItFits: `Cette direction semble cohérente avec le profil actuel.`,
    },
    studentSnapshot: parsed.studentSnapshot || {
      fieldOfInterest: profile.fieldOfInterest,
      academicLevel: profile.academicLevel,
      academicAverage: profile.academicAverage,
      academicConfidence: profile.academicConfidence,
      psychologicalReadiness: profile.psychologicalReadiness,
      familySupport: profile.familySupport,
      mobility: profile.mobility,
      riskTolerance: profile.riskTolerance,
      preferredRegion: profile.preferredRegion,
       preferredLanguage: profile.preferredLanguage,
      budgetMAD: profile.budgetMAD,
      institutionType: profile.institutionType,
    },
    recommendedPaths,
    immediateActions: Array.isArray(parsed.immediateActions) ? parsed.immediateActions : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources : sources.slice(0, 5),
    generatedAt: new Date().toISOString(),
    isFallback: false,
  };
}