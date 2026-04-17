import { readFile } from "node:fs/promises";

import { hasGroq } from "../config/env.js";
import { getLLMResponse } from "./llm.service.js";

const CAREERS_URL = new URL("../data/careers.json", import.meta.url);

const skillRank = { beginner: 1, intermediate: 2, advanced: 3 };
const difficultyRank = { easy: 1, medium: 2, hard: 3 };
const LABELS = ["best_fit", "alternative", "safe_option"];
const ENABLE_AI_REFINEMENT = process.env.ENABLE_AI_CAREER_REFINEMENT === "true";

let careersCache = null;

async function loadCareers() {
  if (!careersCache) {
    const content = await readFile(CAREERS_URL, "utf-8");
    careersCache = JSON.parse(content);
  }

  return careersCache;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(/[,;/]/g))
      .map(normalizeText)
      .filter(Boolean);
  }

  return String(value)
    .split(/[,;/]/g)
    .map(normalizeText)
    .filter(Boolean);
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9+#]+/g)
    .filter((token) => token.length >= 3);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function fieldContainsAny(text, keywords) {
  const normalized = normalizeText(text);
  return normalizeArray(keywords).filter((keyword) => normalized.includes(keyword));
}

function collectCareerKeywords(career) {
  return unique([
    normalizeText(career.category),
    ...normalizeArray(career.tags),
    ...normalizeArray(career.keywords),
    ...normalizeArray(career.coreSkills),
    ...normalizeArray(career.technicalSkills),
    ...normalizeArray(career.softSkills),
    ...normalizeArray(career.relatedFields),
    ...normalizeArray(career.fieldTags),
    ...normalizeArray(career.goalKeywords),
    ...normalizeArray(career.programTags),
    ...normalizeArray(career.roadmapTags),
    ...normalizeArray(career.opportunityTags),
  ]);
}

function matchTerms(profileTerms, careerTerms) {
  const careerSet = new Set(careerTerms);
  const directHits = profileTerms.filter((term) => careerSet.has(term));

  const phraseHits = profileTerms.filter((term) =>
    careerTerms.some((careerTerm) => careerTerm.includes(term) || term.includes(careerTerm)),
  );

  return unique([...directHits, ...phraseHits]);
}

function buildProfileSignals(profile) {
  const interests = unique([
    ...normalizeArray(profile.passions),
    ...normalizeArray(profile.interests),
    ...normalizeArray(profile.themes),
  ]);

  const strengths = unique(normalizeArray(profile.strengths));
  const causes = unique(normalizeArray(profile.causes));
  const values = unique(normalizeArray(profile.values));
  const fieldTokens = unique([
    ...normalizeArray(profile.fieldOfStudy),
    ...tokenize(profile.fieldOfStudy),
  ]);
  const goalTokens = unique([
    ...normalizeArray(profile.personalGoal),
    ...tokenize(profile.personalGoal),
  ]);
  const opportunityTypes = unique(normalizeArray(profile.opportunityTypes));

  return {
    interests,
    strengths,
    causes,
    values,
    fieldTokens,
    goalTokens,
    opportunityTypes,
    skillLevel: normalizeText(profile.skillLevel) || "beginner",
    preferredLocation: normalizeText(profile.preferredLocation) || "remote",
    careerClarity: normalizeText(profile.careerClarity) || "i_dont_know",
    readiness:
      typeof profile.readiness === "number" && Number.isFinite(profile.readiness)
        ? profile.readiness
        : skillRank[normalizeText(profile.skillLevel)] || 1,
  };
}

function addReason(reasons, reason) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function scoreCareer(career, signals) {
  const reasons = [];
  const careerKeywords = collectCareerKeywords(career);
  let score = 0;

  const interestHits = matchTerms(signals.interests, careerKeywords);
  if (interestHits.length) {
    score += Math.min(interestHits.length * 8, 28);
    addReason(reasons, `Matches your interests in ${interestHits.slice(0, 3).join(", ")}.`);
  }

  const strengthHits = matchTerms(signals.strengths, [
    ...normalizeArray(career.strengthTags),
    ...normalizeArray(career.coreSkills),
    ...normalizeArray(career.softSkills),
  ]);
  if (strengthHits.length) {
    score += Math.min(strengthHits.length * 9, 30);
    addReason(reasons, `Uses your strengths in ${strengthHits.slice(0, 3).join(", ")}.`);
  }

  const causeHits = matchTerms(signals.causes, normalizeArray(career.causeTags));
  if (causeHits.length) {
    score += Math.min(causeHits.length * 6, 12);
    addReason(reasons, `Connects with causes you care about: ${causeHits.slice(0, 2).join(", ")}.`);
  }

  const fieldHits = matchTerms(signals.fieldTokens, [
    ...normalizeArray(career.fieldTags),
    ...normalizeArray(career.relatedFields),
  ]);
  if (fieldHits.length) {
    score += Math.min(fieldHits.length * 8, 16);
    addReason(reasons, "Builds naturally from your current academic direction.");
  }

  const goalHits = fieldContainsAny(signals.goalTokens.join(" "), career.goalKeywords);
  if (goalHits.length) {
    score += Math.min(goalHits.length * 8, 16);
    addReason(reasons, "Matches the direction you described for your next step.");
  }

  const valueHits = matchTerms(signals.values, normalizeArray(career.valueTags));
  if (valueHits.length) {
    score += Math.min(valueHits.length * 7, 14);
    addReason(reasons, `Fits your work values: ${valueHits.slice(0, 2).join(", ")}.`);
  }

  const opportunityHits = matchTerms(signals.opportunityTypes, normalizeArray(career.recommendedOpportunities));
  if (opportunityHits.length) {
    score += Math.min(opportunityHits.length * 4, 8);
    addReason(reasons, `Has clear entry points through ${opportunityHits.slice(0, 2).join(", ")}.`);
  }

  const opportunityTagHits = matchTerms(signals.opportunityTypes, normalizeArray(career.opportunityTags));
  if (opportunityTagHits.length) {
    score += Math.min(opportunityTagHits.length * 3, 6);
  }

  const readinessGap =
    (skillRank[signals.skillLevel] || 1) - (difficultyRank[normalizeText(career.entryDifficulty)] || 2);
  if (readinessGap >= 0) {
    score += 10;
    addReason(reasons, "Your current level can support this path.");
  } else if (readinessGap === -1) {
    score += 5;
    addReason(reasons, "Reachable with a focused upskilling phase.");
  }

  if (signals.preferredLocation && normalizeArray(career.locationOptions).includes(signals.preferredLocation)) {
    score += 4;
  }

  const normalizedScore = Math.max(48, Math.min(96, Math.round(45 + score * 0.45)));
  const fallbackReason =
    career.evidenceSnippets?.[0] ||
    "This path is a realistic fit based on the strongest signals in your profile.";

  return {
    ...career,
    score: normalizedScore,
    matchScoreRaw: score,
    confidence: Math.max(0.55, Math.min(0.96, Number((normalizedScore / 100).toFixed(2)))),
    reasons: reasons.length ? reasons.slice(0, 3) : [fallbackReason],
    explanation: buildDeterministicExplanation(career, reasons, signals),
  };
}

function buildDeterministicExplanation(career, reasons, signals) {
  const evidence = Array.isArray(career.evidenceSnippets) ? career.evidenceSnippets[0] : "";
  const mainReason = reasons[0] || "It matches several signals from your profile.";
  const levelNote =
    signals.careerClarity === "i_dont_know"
      ? "It also gives you a practical track to test before committing deeply."
      : "It gives you a clear path to convert your current direction into action.";

  return [mainReason, levelNote, evidence].filter(Boolean).join(" ");
}

function formatChoice(career, index) {
  return {
    label: LABELS[index] || "alternative",
    id: career.id,
    title: career.title,
    category: career.category,
    score: career.score,
    confidence: career.confidence,
    entryDifficulty: career.entryDifficulty,
    shortDescription: career.shortDescription || career.description,
    description: career.description || career.shortDescription,
    reasons: career.reasons.slice(0, 3),
    explanation: career.explanation,
    coreSkills: career.coreSkills || [],
    technicalSkills: career.technicalSkills || [],
    softSkills: career.softSkills || [],
    relatedFields: career.relatedFields || [],
    keywords: career.keywords || [],
    programTags: career.programTags || [],
    opportunityTags: career.opportunityTags || [],
    resourceLinks: career.resourceLinks || [],
    recommendedOpportunities: career.recommendedOpportunities || [],
  };
}

function parseJsonResponse(raw) {
  const cleaned = String(raw || "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  return JSON.parse(cleaned);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("AI enrichment timed out")), ms);
    }),
  ]);
}

async function enrichWithAI(topChoices, profile, trace) {
  if (!ENABLE_AI_REFINEMENT) {
    trace.push("CareerRAG: AI wording refinement skipped for demo stability; local evidence used.");
    return topChoices;
  }

  if (!hasGroq) {
    trace.push("CareerRAG: AI wording refinement skipped because GROQ_API_KEY is not configured.");
    return topChoices;
  }

  const facts = topChoices.map((choice) => ({
    id: choice.id,
    title: choice.title,
    description: choice.description,
    score: choice.score,
    reasons: choice.reasons,
    coreSkills: choice.coreSkills,
    technicalSkills: choice.technicalSkills,
    evidenceSnippets: choice.resourceLinks?.map((link) => `${link.source || link.label}: ${link.url}`) || [],
  }));

  const systemPrompt = [
    "You refine career recommendation wording for Afaq.",
    "Use only the provided career IDs and facts.",
    "Do not invent new careers, schools, links, scores, or claims.",
    "Return only valid JSON: {\"choices\":[{\"id\":\"...\",\"shortDescription\":\"...\",\"reasons\":[\"...\"],\"explanation\":\"...\"}]}",
    "Keep language concise, student-friendly, and grounded.",
  ].join("\n");

  try {
    const raw = await withTimeout(
      getLLMResponse({
        systemPrompt,
        messages: [
          {
            role: "user",
            content: JSON.stringify({ profile, choices: facts }),
          },
        ],
        temperature: 0.15,
        maxTokens: 900,
      }),
      1800,
    );

    const parsed = parseJsonResponse(raw);
    const refinements = Array.isArray(parsed?.choices) ? parsed.choices : [];

    if (!refinements.length) {
      trace.push("CareerRAG: AI refinement returned no usable choices; deterministic wording kept.");
      return topChoices;
    }

    trace.push("CareerRAG: AI refined explanations for selected deterministic careers.");

    return topChoices.map((choice) => {
      const refinement = refinements.find((item) => item?.id === choice.id);
      if (!refinement) return choice;

      return {
        ...choice,
        shortDescription:
          typeof refinement.shortDescription === "string" && refinement.shortDescription.trim()
            ? refinement.shortDescription.trim()
            : choice.shortDescription,
        reasons:
          Array.isArray(refinement.reasons) && refinement.reasons.length
            ? refinement.reasons.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
            : choice.reasons,
        explanation:
          typeof refinement.explanation === "string" && refinement.explanation.trim()
            ? refinement.explanation.trim()
            : choice.explanation,
      };
    });
  } catch (error) {
    trace.push(`CareerRAG: AI refinement unavailable; deterministic wording kept (${error.message}).`);
    return topChoices;
  }
}

export async function recommendCareersFromProfile(profile = {}, { maxResults = 3 } = {}) {
  const careers = await loadCareers();
  const signals = buildProfileSignals(profile);
  const trace = [
    `CareerMatcher: loaded ${careers.length} structured career profiles.`,
    `CareerMatcher: profile signals -> interests=${signals.interests.length}, strengths=${signals.strengths.length}, goals=${signals.goalTokens.length}.`,
  ];

  const scoredCareers = careers
    .map((career) => scoreCareer(career, signals))
    .sort((a, b) => b.matchScoreRaw - a.matchScoreRaw || b.score - a.score);

  const topChoices = scoredCareers.slice(0, Math.max(1, Math.min(maxResults, 3))).map(formatChoice);
  trace.push(`CareerMatcher: selected top ${topChoices.length} careers -> ${topChoices.map((item) => item.id).join(", ")}.`);
  trace.push("CareerRAG: local structured evidence attached before optional AI wording refinement.");

  const enrichedChoices = await enrichWithAI(topChoices, profile, trace);

  return {
    profileSummary: {
      themes: profile.themes || unique([...signals.interests, ...signals.values]).slice(0, 4),
      readiness: signals.readiness,
      careerClarity: profile.careerClarity || "i_dont_know",
    },
    topChoices: enrichedChoices.slice(0, 3),
    scoredCareers,
    agentTrace: trace,
  };
}
