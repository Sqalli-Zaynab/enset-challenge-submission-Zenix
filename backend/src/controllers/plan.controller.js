import { readFile } from "node:fs/promises";

import { reviewPlanDecision } from "../services/plan-review.service.js";

async function readJson(relativePath) {
  const content = await readFile(new URL(relativePath, import.meta.url), "utf-8");
  return JSON.parse(content);
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

function overlaps(left = [], right = []) {
  const rightSet = new Set(normalizeArray(right));
  return normalizeArray(left).filter((item) => rightSet.has(item));
}

function inferThemes(profile, career) {
  const signals = [
    ...normalizeArray(profile.passions),
    ...normalizeArray(profile.interests),
    ...normalizeArray(profile.strengths),
    ...normalizeArray(career?.tags),
  ].join(" ");

  const themes = [];

  if (/(software|coding|web|apps|tech|engineering)/.test(signals)) themes.push("technology");
  if (/(ai|data|math|analysis|research)/.test(signals)) themes.push("analysis");
  if (/(design|creative|content|ux|ui)/.test(signals)) themes.push("creativity");
  if (/(business|startup|product|management|marketing)/.test(signals)) themes.push("business");
  if (/(education|health|community|impact|accessibility)/.test(signals)) themes.push("impact");

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

function rankOpportunities(opportunities, career, profile) {
  const preferredTypes = new Set(normalizeArray(career.recommendedOpportunities));
  const profileTypes = new Set(normalizeArray(profile.opportunityTypes));
  const careerTags = normalizeArray(career.tags);
  const profileSignals = [
    ...normalizeArray(profile.interests),
    ...normalizeArray(profile.passions),
    normalizeText(profile.fieldOfStudy),
  ];

  return opportunities
    .map((opportunity) => {
      const type = normalizeText(opportunity.type);
      const tags = normalizeArray(opportunity.tags);
      let score = 0;

      if (preferredTypes.has(type)) score += 4;
      if (profileTypes.has(type)) score += 3;
      score += overlaps(tags, careerTags).length * 2;
      score += overlaps(tags, profileSignals).length;
      if (opportunity.location === profile.preferredLocation) score += 1;

      return { opportunity, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.opportunity)
    .slice(0, 4);
}

function selectStudyOptions(schools, career, profile) {
  const targetTags = [
    ...normalizeArray(career.tags),
    ...normalizeArray(career.fieldTags),
    normalizeText(profile.fieldOfStudy),
  ];

  const ranked = schools
    .map((school) => ({
      school,
      score:
        overlaps(school.fieldTags, targetTags).length * 3 +
        (normalizeText(school.city) === normalizeText(profile.preferredLocation) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.school)
    .slice(0, 4);

  return ranked.map((school) => ({
    program: school.program || career.title,
    school: school.name,
    city: school.city,
    link: school.officialUrl,
  }));
}

export const generatePlan = async (req, res) => {
  try {
    const [careers, opportunities, schools] = await Promise.all([
      readJson("../data/careers.json"),
      readJson("../data/oportunities.json"),
      readJson("../data/knowledge/morocco-universities.json"),
    ]);

    const selectedCareerId = String(req.body?.selectedCareerId || "");
    const career =
      careers.find((item) => item.id === selectedCareerId) ??
      careers.find((item) => item.id === "software-engineering") ??
      careers[0];

    const profile = buildProfile(req.body || {}, career);
    const recommendedOpportunities = rankOpportunities(opportunities, career, profile);
    const studyOptions = selectStudyOptions(schools, career, profile);

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
