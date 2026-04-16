import { extractStructuredInfo } from './llm-extraction.service.js';

export async function buildStudentProfile(messages = [], previous = {}) {
  const extracted = await extractStructuredInfo(messages);

  const profile = {
    ...previous,
    ...extracted,
    fieldOfInterest: extracted.fieldOfInterest || previous.fieldOfInterest,
    academicLevel: extracted.academicLevel || previous.academicLevel,
    preferredRegion: extracted.preferredRegion || previous.preferredRegion,
    preferredLanguage: extracted.preferredLanguage || previous.preferredLanguage,
    institutionType: extracted.institutionType || previous.institutionType,
    budgetMAD: extracted.budgetMAD || previous.budgetMAD,
  };

  const missing = [
    !profile.fieldOfInterest ? "fieldOfInterest" : null,
    !profile.academicLevel ? "academicLevel" : null,
    !profile.preferredRegion ? "preferredRegion" : null,
    !profile.preferredLanguage ? "preferredLanguage" : null,
    !profile.institutionType ? "institutionType" : null,
    !profile.budgetMAD ? "budgetMAD" : null,
  ].filter(Boolean);

  const completenessScore = Math.max(0, 100 - missing.length * 12);

  return {
    ...profile,
    missing,
    completenessScore,
  };
}

export function getProfileSummary(profile) {
  return {
    studyField: profile.fieldOfInterest,
    level: profile.academicLevel,
    cityPreference: profile.preferredRegion,
    budgetMAD: profile.budgetMAD,
    readinessBand: "moderate", // can be removed or computed dynamically if needed
  };
}