import { readFile } from "node:fs/promises";

import { selectStudyPrograms } from "../services/morocco-program-retrieval.service.js";
import { buildOpportunityRecommendations } from "../services/opportunity-matching.service.js";
import { reviewPlanDecision } from "../services/plan-review.service.js";

async function readJson(relativePath, fallbackValue = null) {
  try {
    const content = await readFile(new URL(relativePath, import.meta.url), "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (fallbackValue !== null) {
      console.warn(`Plan data fallback used for ${relativePath}:`, error.message);
      return fallbackValue;
    }

    throw error;
  }
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(","))
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function inferThemes(profile, career) {
  const signals = [
    ...normalizeArray(profile.passions),
    ...normalizeArray(profile.interests),
    ...normalizeArray(profile.strengths),
    ...normalizeArray(career?.tags),
    ...normalizeArray(career?.keywords),
    ...normalizeArray(career?.category),
  ].join(" ");

  const themes = [];

  if (/(software|coding|web|apps|tech|engineering)/.test(signals)) themes.push("technology");
  if (/(ai|data|math|analysis|research)/.test(signals)) themes.push("analysis");
  if (/(design|creative|content|ux|ui|media|graphic)/.test(signals)) themes.push("creativity");
  if (/(business|startup|product|management|marketing|hr|operations)/.test(signals)) themes.push("business");
  if (/(education|teaching|health|community|impact|accessibility|talent)/.test(signals)) themes.push("impact");
  if (/(industrial|electronics|embedded|iot|hardware|factory|quality)/.test(signals)) themes.push("engineering");

  return themes.length ? themes : ["career exploration"];
}

function buildProfile(payload, career) {
  return {
    passions: normalizeArray(payload.passions),
    interests: normalizeArray(payload.interests),
    causes: normalizeArray(payload.causes),
    strengths: normalizeArray(payload.strengths),
    academicLevel: payload.academicLevel || "undergraduate",
    fieldOfStudy: payload.fieldOfStudy || career?.title || "general exploration",
    skillLevel: payload.skillLevel || "beginner",
    personalGoal: payload.personalGoal || "Build a realistic career direction.",
    careerClarity: payload.careerClarity || "some_ideas",
    mainChallenge: payload.mainChallenge || "i_dont_know_what_fits_me",
    values: normalizeArray(payload.values),
    opportunityTypes: normalizeArray(payload.opportunityTypes),
    preferredLocation: payload.preferredLocation || "local",
    themes: inferThemes(payload, career),
    readiness: payload.skillLevel === "advanced" ? 3 : payload.skillLevel === "intermediate" ? 2 : 1,
  };
}

export const generatePlan = async (req, res) => {
  try {
    const [careers, schools, programs] = await Promise.all([
      readJson("../data/careers.json"),
      readJson("../data/knowledge/morocco-universities.json", []),
      readJson("../data/knowledge/morocco-programs.json", []),
    ]);

    const selectedCareerId = String(req.body?.selectedCareerId || "");
    const career =
      careers.find((item) => item.id === selectedCareerId) ??
      careers.find((item) => item.id === "software-engineering") ??
      careers[0];

    const profile = buildProfile(req.body || {}, career);
    const [{ opportunities: recommendedOpportunities, retrievalTrace: opportunityTrace }, { studyOptions, retrievalTrace }] = await Promise.all([
      buildOpportunityRecommendations({ career, profile }),
      selectStudyPrograms({
      programs,
      fallbackSchools: schools,
      career,
      profile,
      }),
    ]);

    res.json({
      profile,
      selectedPath: {
        id: career.id,
        title: career.title,
        shortDescription: career.shortDescription,
      },
      roadmap: career.roadmap,
      recommendedOpportunities,
      studyOptions,
      explanation: `A practical 90-day roadmap for ${career.title}, based on your interests, strengths, and preferred opportunities.`,
      agentTrace: [
        "PlanAgent: deterministic demo-safe plan generated",
        `PlanAgent: selected career -> ${career.title}`,
        `PlanAgent: matched ${recommendedOpportunities.length} opportunities`,
        `PlanAgent: matched ${studyOptions.length} study options`,
        ...retrievalTrace,
        ...opportunityTrace,
      ],
    });
  } catch (error) {
    console.error("Plan generation error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const submitPlanDecision = async (req, res) => {
  try {
    const result = reviewPlanDecision(req.validatedBody);
    res.json(result);
  } catch (error) {
    console.error("Plan decision error:", error);
    res.status(500).json({ error: error.message });
  }
};
