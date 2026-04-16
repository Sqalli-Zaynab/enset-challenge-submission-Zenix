import { generateStructuredStudyPlan } from "../../services/study-plan.service.js";

export async function buildStudyPlanNode(state) {
  const profile = state.studentProfile || {};
  const sources = state.verifiedSources || [];
  const finalizeReason = state.finalizeReason || null;

  const plan = await generateStructuredStudyPlan(profile, sources, finalizeReason);

  return {
    plan,
    trace: [
      `BuildStudyPlan: sources=${sources.length}`,
      `BuildStudyPlan: fallback=${Boolean(plan.isFallback)}`,
      `BuildStudyPlan: completionMode=${plan.completionMode}`,
    ],
  };
}