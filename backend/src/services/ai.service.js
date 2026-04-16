// backend/src/services/ai.service.js
import { runAgentGraph } from "../agent/graph.mjs";

// Named exports for direct imports
export async function runProfileAnalysis(profileData) {
  return runAgentGraph("analyze", profileData);
}

export async function runCareerRecommendation(profileData) {
  return runAgentGraph("recommend", profileData);
}

export async function runPlanGeneration(pathData) {
  return runAgentGraph("plan", pathData);
}

export async function runChatAdvisor(chatData) {
  return runAgentGraph("chat", chatData);
}

// Default export for backward compatibility with controllers
const aiService = {
  runProfileAnalysis,
  runCareerRecommendation,
  runPlanGeneration,
  runChatAdvisor,
  // Map to names used by your controllers (e.g., analyzeProfile, recommendCareers, generatePlan)
  analyzeProfile: runProfileAnalysis,
  recommendCareers: runCareerRecommendation,
  generatePlan: runPlanGeneration,
};

export default aiService;