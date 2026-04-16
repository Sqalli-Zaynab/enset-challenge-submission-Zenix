// agent/nodes/profileNode.js
// LangGraph node that builds a normalized user profile from input payload

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

function inferThemes(profile) {
  const allSignals = [
    ...profile.passions,
    ...profile.interests,
    ...profile.causes,
    ...profile.strengths,
    ...profile.values,
    profile.personalGoal || "",
  ].join(" ");

  const buckets = {
    technology: ["ai", "software", "coding", "code", "data", "cyber", "web", "app", "apps", "tech"],
    business: ["business", "marketing", "management", "product", "startup", "entrepreneurship", "sales"],
    creativity: ["design", "creative", "ui", "ux", "video", "content", "art", "branding"],
    impact: ["education", "health", "social", "community", "accessibility", "environment"],
    analysis: ["math", "analysis", "research", "problem solving", "statistics", "modeling"],
  };

  return Object.entries(buckets)
    .map(([theme, keywords]) => ({
      theme,
      score: keywords.reduce((acc, keyword) => acc + (allSignals.includes(keyword) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.theme);
}

function profileReadiness(profile) {
  const skillRank = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
  };
  const base = skillRank[profile.skillLevel] || 1;
  const clarityBoost = {
    i_dont_know: 0,
    some_ideas: 0,
    i_know: 1,
  }[profile.careerClarity] || 0;
  return Math.min(base + clarityBoost, 3);
}

/**
 * Profile Node for LangGraph
 * Takes state.payload and produces state.profile
 * @param {Object} state - LangGraph state (must contain payload)
 * @returns {Promise<Object>} Partial state update with profile and trace
 */
export async function profileNode(state) {
  const input = state.payload || {};

  // Normalize all input fields
  const profile = {
    passions: normalizeArray(input.passions),
    interests: normalizeArray(input.interests),
    causes: normalizeArray(input.causes),
    strengths: normalizeArray(input.strengths),
    academicLevel: normalizeText(input.academicLevel || input.level || "high_school"),
    fieldOfStudy: normalizeText(input.fieldOfStudy || input.field || "general"),
    skillLevel: normalizeText(input.skillLevel || "beginner"),
    careerClarity: normalizeText(input.careerClarity || "i_dont_know").replace(/\s+/g, "_"),
    personalGoal: normalizeText(input.personalGoal),
    mainChallenge: normalizeText(input.mainChallenge || "").replace(/\s+/g, "_"),
    opportunityTypes: normalizeArray(input.opportunityTypes),
    preferredLocation: normalizeText(input.preferredLocation || "remote"),
    values: normalizeArray(input.values || input.workValues),
    workStyle: normalizeText(input.workStyle || "hybrid"),
    subjectsEnjoyed: normalizeArray(input.subjectsEnjoyed),
    subjectsAvoided: normalizeArray(input.subjectsAvoided),
    languages: normalizeArray(input.languages),
  };

  // Infer themes and readiness
  const themes = inferThemes(profile);
  const readiness = profileReadiness(profile);

  const enrichedProfile = {
    ...profile,
    themes,
    readiness,
  };

  const traceMessages = [
    `ProfileAgent: normalized ${profile.interests.length + profile.passions.length + profile.strengths.length} preference signals`,
    `ProfileAgent: inferred themes -> ${themes.join(", ") || "general exploration"}`,
    `ProfileAgent: readiness level -> ${readiness}/3`,
  ];

  return {
    profile: enrichedProfile,
    trace: traceMessages,
  };
}