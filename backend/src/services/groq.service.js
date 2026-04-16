import Groq from "groq-sdk";
import { env, hasGroq } from "../config/env.js";

const groq = hasGroq ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

export async function generateChatCompletion(messages, options = {}) {
  if (!groq) {
    return JSON.stringify({
      summary: "Mock mode active",
      recommendedPaths: [],
      immediateActions: ["Configure GROQ_API_KEY for real model output."],
      redFlags: ["Mock response returned because GROQ_API_KEY is missing."],
      sources: [],
    });
  }
   try {
    const completion = await groq.chat.completions.create({
      messages,
      model: options.model || env.GROQ_MODEL,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens || 2500,
    });

    return completion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Groq API error:", error.message);
    return JSON.stringify({
      summary: "AI generation failed",
      recommendedPaths: [],
      immediateActions: ["Retry request", "Check GROQ API quota / key"],
      redFlags: [`Groq API error: ${error.message}`],
      sources: [],
    });
  }
}