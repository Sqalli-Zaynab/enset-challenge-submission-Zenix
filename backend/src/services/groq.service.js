// backend/services/groq.service.js
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Available models on Groq's free tier:
// - "llama-3.3-70b-versatile" (best quality, ~70B params)
// - "llama-3.1-8b-instant" (faster, ~8B params)
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

/**
 * Generate a chat completion using Groq's Llama model
 * @param {Array} messages - Array of {role, content} messages
 * @param {Object} options - Optional parameters (temperature, model, etc.)
 * @returns {Promise<string>} - The assistant's response
 */
export async function generateChatCompletion(messages, options = {}) {
  try {
    const completion = await groq.chat.completions.create({
      messages: messages,
      model: options.model || DEFAULT_MODEL,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 4096,
    });
    
    return completion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Groq API error:", error);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

/**
 * Extract structured information from a conversation using Groq
 * @param {Array} messages - Conversation history
 * @param {string} schema - JSON schema for extraction
 * @returns {Promise<Object>} - Extracted structured data
 */
export async function extractStructuredData(messages, schema) {
  const extractionPrompt = `
    You are a data extraction assistant. Extract the requested information from the conversation.
    Return ONLY valid JSON matching this schema:
    ${JSON.stringify(schema, null, 2)}
    
    Conversation:
    ${JSON.stringify(messages, null, 2)}
  `;
  
  const response = await generateChatCompletion([
    { role: "system", content: "You are a precise data extraction assistant. Always return valid JSON." },
    { role: "user", content: extractionPrompt }
  ], { temperature: 0.1 });
  
  // Clean up markdown code blocks if present
  const cleanedResponse = response.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  return JSON.parse(cleanedResponse);
}