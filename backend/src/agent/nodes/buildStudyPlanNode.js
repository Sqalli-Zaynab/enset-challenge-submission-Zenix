import { generateStructuredStudyPlan } from "../../services/study-plan.service.js";

export async function buildStudyPlanNode(state) {
  const profile = state.studentProfile || {};
  const sources = state.verifiedSources || [];

  const plan = await generateStructuredStudyPlan(profile, sources);

  return {
    plan,
    trace: [
      `BuildStudyPlan: sources=${sources.length}`,
      `BuildStudyPlan: fallback=${Boolean(plan.isFallback)}`,
    ],
  };
}