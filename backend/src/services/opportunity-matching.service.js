import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { retrieveTrustedOpportunityLeads } from "./trusted-opportunity-retrieval.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_FILE = path.join(__dirname, "../data/knowledge/opportunities-fallback.json");

const RESULT_LIMIT = 5;

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function normalizeArray(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => String(item).split(","))
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toTitleCase(value = "") {
  return String(value)
    .split(/[\s-]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function overlaps(left = [], right = []) {
  const rightSet = new Set(right);
  return unique(left).filter((item) => rightSet.has(item));
}

function normalizeOpportunity(item = {}) {
  const tags = unique([
    ...normalizeArray(item.opportunityTags),
    ...normalizeArray(item.skills),
    ...normalizeArray(item.careerTargets),
    normalizeText(item.type),
  ]);

  return {
    id: String(item.id || ""),
    title: String(item.title || "Opportunity").trim(),
    type: normalizeText(item.type || "project"),
    provider: String(item.provider || "Trusted source").trim(),
    sourceUrl: String(item.sourceUrl || "").trim(),
    location: String(item.location || "Remote").trim(),
    mode: normalizeText(item.mode || "hybrid"),
    deadline: typeof item.deadline === "string" && item.deadline.trim() ? item.deadline : null,
    careerTargets: normalizeArray(item.careerTargets),
    skills: normalizeArray(item.skills),
    eligibility: normalizeArray(item.eligibility),
    summary: String(item.summary || "").trim(),
    whyRelevant: String(item.whyRelevant || "").trim(),
    sourceType: item.sourceType === "trusted-rag" ? "trusted-rag" : "fallback-local",
    opportunityTags: tags,
    readinessFloor: Number.isFinite(Number(item.readinessFloor)) ? Number(item.readinessFloor) : 1,
    trustScore: Number.isFinite(Number(item.trustScore))
      ? Number(item.trustScore)
      : item.sourceType === "trusted-rag"
        ? 9
        : 6,
    retrievalEvidence:
      item.retrievalEvidence && typeof item.retrievalEvidence === "object"
        ? item.retrievalEvidence
        : null,
  };
}

async function loadFallbackCatalog() {
  const content = await fs.readFile(FALLBACK_FILE, "utf-8");
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed.map(normalizeOpportunity) : [];
}

function buildSignalSet({ career, profile }) {
  return unique([
    normalizeText(career?.id),
    ...normalizeArray(career?.tags),
    ...normalizeArray(career?.keywords),
    ...normalizeArray(career?.roadmapTags),
    ...normalizeArray(career?.technicalSkills),
    ...normalizeArray(career?.coreSkills),
    ...normalizeArray(career?.opportunityTags),
    ...normalizeArray(career?.recommendedOpportunities),
    ...normalizeArray(profile?.interests),
    ...normalizeArray(profile?.passions),
    ...normalizeArray(profile?.strengths),
    ...normalizeArray(profile?.causes),
    ...normalizeArray(profile?.opportunityTypes),
    ...normalizeArray(profile?.values),
    normalizeText(profile?.fieldOfStudy),
    normalizeText(profile?.preferredLocation),
  ]);
}

function preferredTypes(profile = {}, career = {}) {
  return new Set(
    unique([
      ...normalizeArray(profile?.opportunityTypes).map((item) => item.replace(/s$/, "")),
      ...normalizeArray(career?.recommendedOpportunities).map((item) => item.replace(/s$/, "")),
      ...normalizeArray(career?.opportunityTags).map((item) => item.replace(/s$/, "")),
    ]),
  );
}

function freshnessScore(deadline) {
  if (!deadline) return 0;
  const now = new Date();
  const target = new Date(deadline);

  if (Number.isNaN(target.getTime())) return 0;

  const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return -4;
  if (diffDays <= 21) return 4;
  if (diffDays <= 90) return 2;
  return 1;
}

function formatWhyRelevant(item, reasons) {
  const pieces = [];

  if (reasons.career) pieces.push(`aligned with ${reasons.career}`);
  if (reasons.skills.length) pieces.push(`builds ${reasons.skills.slice(0, 2).join(" and ")}`);
  if (reasons.preference) pieces.push(`matches your preference for ${reasons.preference}`);
  if (reasons.source) pieces.push(`comes from a ${reasons.source} source`);

  if (!pieces.length) {
    return "Relevant because it supports the selected path with practical next-step experience.";
  }

  return `Relevant because it is ${pieces.join(", ")}.`;
}

function scoreOpportunity(item, { career, profile, signalSet, preferredTypeSet }) {
  let score = 10;
  const reasons = {
    career: "",
    skills: [],
    preference: "",
    source: item.sourceType === "trusted-rag" ? "trusted" : "curated fallback",
  };

  if (item.careerTargets.includes(normalizeText(career?.id))) {
    score += 22;
    reasons.career = career?.title || "your selected career";
  }

  const skillHits = overlaps(item.skills, signalSet);
  const tagHits = overlaps(item.opportunityTags, signalSet);
  score += skillHits.length * 4;
  score += tagHits.length * 3;
  reasons.skills = unique([...skillHits, ...tagHits]).slice(0, 3);

  const singularType = normalizeText(item.type).replace(/s$/, "");
  if (preferredTypeSet.has(singularType)) {
    score += 8;
    reasons.preference = toTitleCase(singularType);
  }

  if (normalizeText(profile?.preferredLocation) === "remote" && normalizeText(item.location).includes("remote")) {
    score += 3;
  }

  if (normalizeText(profile?.preferredLocation) === "local" && /morocco|local/.test(normalizeText(item.location))) {
    score += 3;
  }

  const readiness = Number.isFinite(Number(profile?.readiness)) ? Number(profile.readiness) : 1;
  if (readiness >= item.readinessFloor) {
    score += 4;
  } else {
    score -= 5;
  }

  score += freshnessScore(item.deadline);
  score += item.trustScore;

  return {
    ...item,
    whyRelevant: item.whyRelevant || formatWhyRelevant(item, reasons),
    score,
  };
}

function dedupeOpportunities(items = []) {
  const deduped = [];
  const seen = new Set();

  for (const item of items) {
    const key = `${normalizeText(item.title)}:${normalizeText(item.provider)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export async function buildOpportunityRecommendations({ career, profile, limit = RESULT_LIMIT }) {
  const [fallbackCatalog, trustedResult] = await Promise.all([
    loadFallbackCatalog(),
    retrieveTrustedOpportunityLeads({ career, profile }),
  ]);

  const signalSet = buildSignalSet({ career, profile });
  const preferredTypeSet = preferredTypes(profile, career);

  const combined = dedupeOpportunities([
    ...trustedResult.opportunities.map(normalizeOpportunity),
    ...fallbackCatalog,
  ]);

  const scored = combined
    .map((item) => scoreOpportunity(item, { career, profile, signalSet, preferredTypeSet }))
    .sort((left, right) => right.score - left.score);

  const selected = scored.slice(0, limit).map((item, index) => ({
    id: item.id || `opportunity-${index + 1}`,
    title: item.title,
    type: toTitleCase(item.type),
    provider: item.provider,
    sourceUrl: item.sourceUrl,
    location: item.location,
    mode: item.mode,
    deadline: item.deadline,
    careerTargets: item.careerTargets,
    skills: item.skills,
    eligibility: item.eligibility,
    summary: item.summary,
    whyRelevant: item.whyRelevant,
    sourceType: item.sourceType,
  }));

  const trustedCount = selected.filter((item) => item.sourceType === "trusted-rag").length;
  const fallbackCount = selected.filter((item) => item.sourceType === "fallback-local").length;

  return {
    opportunities: selected,
    retrievalTrace: [
      ...trustedResult.retrievalTrace,
      `OpportunityMatch: fallback catalog size -> ${fallbackCatalog.length}`,
      `OpportunityMatch: combined candidate pool -> ${combined.length}`,
      `OpportunityMatch: returning ${selected.length} results (${trustedCount} trusted, ${fallbackCount} fallback)`,
    ],
  };
}
