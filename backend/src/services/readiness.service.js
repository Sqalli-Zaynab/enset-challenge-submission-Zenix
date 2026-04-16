export function evaluateInterviewReadiness(profile = {}) {
  const missingCritical = [
    !profile.fieldOfInterest ? "fieldOfInterest" : null,
    !profile.academicLevel ? "academicLevel" : null,
    profile.academicConfidence == null ? "academicConfidence" : null,
    !profile.preferredRegion ? "preferredRegion" : null,
    !profile.preferredLanguage ? "preferredLanguage" : null,
    !profile.institutionType ? "institutionType" : null,
    profile.budgetMAD == null ? "budgetMAD" : null,
  ].filter(Boolean);

  const missingPsychological = [
    profile.psychologicalReadiness == null ? "psychologicalReadiness" : null,
    profile.familySupport == null ? "familySupport" : null,
    profile.riskTolerance == null ? "riskTolerance" : null,
  ].filter(Boolean);

  const missingLogistics = [
    profile.mobility == null ? "mobility" : null,
    profile.workWhileStudying == null ? "workWhileStudying" : null,
  ].filter(Boolean);
  const academicKnown = Boolean(profile.academicLevel && profile.academicConfidence != null);
  const economicKnown = Boolean(profile.budgetMAD != null);
  const psychologicalKnown = missingPsychological.length <= 1;
  const logisticsKnown = missingLogistics.length <= 1;
  const directionKnown = Boolean(profile.fieldOfInterest || profile.careerGoal);

  const ready =
    missingCritical.length === 0 &&
    academicKnown &&
    economicKnown &&
    psychologicalKnown &&
    logisticsKnown &&
    directionKnown;
const coverageScore = [
    directionKnown,
    academicKnown,
    economicKnown,
    psychologicalKnown,
    logisticsKnown,
    Boolean(profile.preferredLanguage),
    Boolean(profile.institutionType),
  ].filter(Boolean).length * 14;

  return {
    ready,
    coverageScore: Math.min(100, coverageScore),
    missingCritical,
    missingPsychological,
    missingLogistics,
    interviewStage: ready ? "planning" : coverageScore >= 70 ? "deepening" : "discovery",
  };
}