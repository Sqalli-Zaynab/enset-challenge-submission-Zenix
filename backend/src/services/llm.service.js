// backend/src/services/llm.service.js
import { generateChatCompletion } from './groq.service.js';

// Generate a response using Groq (or fallback mock)
export async function generateResponse(prompt, options = {}) {
  try {
    const messages = [{ role: "user", content: prompt }];
    const response = await generateChatCompletion(messages, options);
    return response;
  } catch (error) {
    console.error("LLM service error:", error);
    // Fallback mock response
    return "I understand you're asking about career guidance. Based on your interests, I recommend exploring fields like technology, business, or healthcare. Could you provide more details about your preferences?";
  }
}

// For evaluation summary (if needed)
export function getEvaluationSummary() {
  return {
    totalPrompts: 5,
    averageScore: 85,
    fineTuningStatus: "simulated",
  };
}