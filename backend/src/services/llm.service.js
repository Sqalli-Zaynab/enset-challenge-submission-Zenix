import { generateChatCompletion } from "./groq.service.js";

export async function generateResponse(
  prompt,
  { temperature = 0.2, maxTokens = 900 } = {},
) {
  return generateChatCompletion(
    [{ role: "user", content: prompt }],
    {
      temperature,
      max_tokens: maxTokens,
    },
  );
}

export async function getLLMResponse({
  systemPrompt = "",
  messages = [],
  temperature = 0.2,
  maxTokens = 900,
} = {}) {
  const finalMessages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...(Array.isArray(messages) ? messages : []),
  ];

  return generateChatCompletion(finalMessages, {
    temperature,
    max_tokens: maxTokens,
  });
}

export async function extractStructuredInfo(messages = []) {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  const prompt = `
From the conversation below, extract the following fields.
Return ONLY valid JSON with these exact keys.
Use null if the information is not present.

Fields:
- fieldOfInterest (e.g., Medicine, Engineering, Business, Law, Arts, etc.)
- academicLevel (one of: Baccalaureate, Bachelor, Master)
- preferredRegion (a Moroccan city: Casablanca, Rabat, Marrakech, Fes, Tanger, Agadir, etc.)
- preferredLanguage (one of: French, English, Arabic)
- institutionType (one of: public, private, any)
- budgetMAD (a number, the annual budget in Moroccan dirhams)

Conversation:
${userMessages}
`;

  try {
    const response = await generateChatCompletion(
      [{ role: "user", content: prompt }],
      { temperature: 0.2, max_tokens: 700 },
    );

    const cleaned = response
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.warn(
      "LLM extraction failed, returning empty extraction:",
      error.message,
    );

    return {
      fieldOfInterest: null,
      academicLevel: null,
      preferredRegion: null,
      preferredLanguage: null,
      institutionType: null,
      budgetMAD: null,
    };
  }
}