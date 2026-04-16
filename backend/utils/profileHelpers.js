// agent/utils/profileHelpers.js
// Shared helper functions for profile processing

export function normalizeArray(value) {
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

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function inferThemes(profile) {
  const allSignals = [
    ...profile.passions,
    ...profile.interests,
    ...profile.causes,
    ...profile.strengths,
    ...profile.values,
    ...profile.subjectsEnjoyed,
    ...profile.subjectsAvoided.map((item) => `avoid:${item}`),
    profile.personalGoal?.toLowerCase() || "",
  ].join(" ");

  const buckets = {
    technology: ["ai", "software", "coding", "code", "data", "cyber", "web", "app", "apps", "tech", "logic"],
    business: ["business", "marketing", "management", "product", "startup", "entrepreneurship", "sales", "strategy"],
    creativity: ["design", "creative", "ui", "ux", "video", "content", "art", "branding"],
    impact: ["education", "health", "social", "community", "accessibility", "environment", "impact"],
    analysis: ["math", "analysis", "research", "problem solving", "statistics", "modeling"],
  };

  const scores = Object.entries(buckets).map(([theme, keywords]) => {
    const score = keywords.reduce((acc, keyword) => acc + (allSignals.includes(keyword) ? 1 : 0), 0);
    return { theme, score };
  });

  return scores
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.theme);
}

const skillRank = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

export function profileReadiness(profile) {
  const base = skillRank[profile.skillLevel] || 1;
  const clarityBoost = {
    i_dont_know: 0,
    some_ideas: 0,
    i_know: 1,
  }[profile.careerClarity] || 0;
  return Math.min(base + clarityBoost, 3);
}