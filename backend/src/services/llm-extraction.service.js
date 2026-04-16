import { generateChatCompletion } from './groq.service.js';

function emptyExtraction() {
  return {
    fieldOfInterest: null,
    academicLevel: null,
    preferredRegion: null,
    preferredLanguage: null,
    institutionType: null,
    budgetMAD: null,
  };
}

function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // ignore
    }
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function extractStructuredInfo(messages = []) {
  const recentUserMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m?.role === 'user' && typeof m.content === 'string')
    .slice(-6)
    .map((m) => m.content.trim())
    .filter(Boolean);

  const conversation = recentUserMessages.join('\n').slice(-2400);
  if (!conversation) {
    return emptyExtraction();
  }

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
${conversation}
`;

  try {
    const response = await generateChatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, max_tokens: 400 },
    );

    const parsed = safeParseJson(response);
    if (!parsed || typeof parsed !== 'object') {
      return emptyExtraction();
    }

    return {
      ...emptyExtraction(),
      ...parsed,
    };
  } catch (error) {
    console.warn('LLM extraction failed, returning empty extraction:', error.message);
    return emptyExtraction();
  }
}