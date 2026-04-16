export function reviewPlanDecision({ decision, feedback = "", threadId, plan = null }) {
  if (decision === "approved") {
    return {
      status: "approved",
      threadId,
      approvedAt: new Date().toISOString(),
      message: "Le plan a été validé.",
      plan,
    };
  }

  return {
    status: "revision_requested",
    threadId,
    feedback,
    message: "Révision demandée. Renvoyez le feedback dans /api/chat avec le même threadId.",
    suggestedPrompt:
      feedback ||
      "Je veux une version plus réaliste, moins risquée, adaptée à mon budget et avec des sources plus officielles.",
  };
}