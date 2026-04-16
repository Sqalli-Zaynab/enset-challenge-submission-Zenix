import Groq from "groq-sdk";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

let apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.warn("⚠️ GROQ_API_KEY not found. Using mock responses.");
}

let groq;
if (apiKey) {
  groq = new Groq({ apiKey });
}

export async function generateChatCompletion(messages, options = {}) {
  if (!groq) {
    console.log("Mock Groq response for:", messages[0]?.content?.substring(0, 50));
    return "This is a mock response because GROQ_API_KEY is missing. Please add it to .env for real AI responses.";
  }
  try {
    const completion = await groq.chat.completions.create({
      messages,
      model: options.model || "llama-3.3-70b-versatile",
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens || 4096,
    });
    return completion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Groq API error:", error);
    return "Groq API error: " + error.message;
  }
}