import { generateChatCompletion } from './groq.service.js';

export async function generateDynamicQuestionFromProfile(profile, conversationHistory) {
  const missingFields = profile.missing || [];
  if (missingFields.length === 0) return null;

  const missingKey = missingFields[0];

  const fallbackTemplates = {
    fieldOfInterest: `What field are you most excited about – something like Medicine, Engineering, Business, or maybe Arts?`,
    academicLevel: `Are you currently in high school (Baccalaureate), university (Bachelor), or already have a degree (Master)?`,
    preferredRegion: `Which Moroccan city would you love to study in – Casablanca, Rabat, Marrakech, or somewhere else?`,
    preferredLanguage: `Would you prefer to study in French, English, or Arabic?`,
    institutionType: `Do you have a preference for public or private universities?`,
    budgetMAD: `What's your approximate annual budget for tuition and living costs (in MAD)?`
  };

  try {
    const prompt = `
      You are a friendly academic advisor. The student has already told you:
      ${JSON.stringify(profile, null, 2)}

      You still need to ask about: ${missingKey}

      Based on the conversation history below, ask a short, natural, personal question that asks ONLY for the missing information.
      Do not ask about anything else. Return ONLY the question.

      Conversation history:
      ${JSON.stringify(conversationHistory.slice(-5))}
    `;

    const response = await generateChatCompletion([{ role: 'user', content: prompt }], { temperature: 0.7 });
    if (response && response.trim()) {
      return response.trim();
    }
    throw new Error('Empty response');
  } catch (error) {
    console.warn('LLM question generation failed, using dynamic fallback:', error.message);
    return fallbackTemplates[missingKey] || `Could you tell me about ${missingKey}?`;
  }
}