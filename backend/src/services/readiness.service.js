function hasAcademicSignal(profile = {}) {
  return profile.academicConfidence != null || profile.academicAverage != null;
}

function hasBudgetSignal(profile = {}) {
  return profile.budgetMAD != null || profile.financialAidNeeded != null;
}

export function evaluateInterviewReadiness(
  profile = {},
  { questionCount = 0, maxQuestions = 10 } = {},
) {
  const coverageChecks = {
    fieldOfInterest: Boolean(profile.fieldOfInterest),
    academicLevel: Boolean(profile.academicLevel),
    academicStrength: hasAcademicSignal(profile),
    preferredRegion: Boolean(profile.preferredRegion),
    institutionType: Boolean(profile.institutionType),
    budget: hasBudgetSignal(profile),
    preferredLanguage: Boolean(profile.preferredLanguage),
    riskStyle: profile.riskTolerance != null,
    mobility: profile.mobility != null,
  };

  const covered = Object.values(coverageChecks).filter(Boolean).length;
  const coverageScore = Math.round((covered / Object.keys(coverageChecks).length) * 100);

  const missingCore = Object.entries(coverageChecks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);

  const softReady =
    covered >= 6 &&
    Boolean(profile.fieldOfInterest) &&
    Boolean(profile.academicLevel) &&
    Boolean(profile.preferredRegion);

  const maxQuestionsReached = questionCount >= maxQuestions;
  const ready = softReady || maxQuestionsReached;

  return {
    ready,
    softReady,
    maxQuestionsReached,
    coverageScore,
    missingCore,
    interviewStage: ready ? "planning" : coverageScore >= 45 ? "focusing" : "discovery",
    finalizeReason: softReady
      ? "enough_information"
      : maxQuestionsReached
        ? "max_questions_reached"
        : null,
  };
}