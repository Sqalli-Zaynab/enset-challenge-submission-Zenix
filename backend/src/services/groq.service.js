import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateChatCompletion(messages, options = {}) {
  const completion = await groq.chat.completions.create({
    messages,
    model: options.model || "llama-3.3-70b-versatile",
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens || 4096,
  });
  return completion.choices[0]?.message?.content || "";
}