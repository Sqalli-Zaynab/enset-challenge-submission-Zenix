// agent/nodes/profileNode.js
// LangGraph node that builds a normalized user profile from input payload

import { normalizeArray, normalizeText, inferThemes, profileReadiness } from "../utils/profileHelpers.js";

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