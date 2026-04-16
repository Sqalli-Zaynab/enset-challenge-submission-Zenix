// backend/src/agent/nodes/chatNode.js
import { getLLMResponse } from '../../services/llm.service.js';

const PHASES = { GENERAL: 'general', SPECIFIC: 'specific', FIELD: 'field', PATH: 'path' };

function extractInfo(messages) {
  const userText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase())
    .join(' ');

  let field = null, level = null, region = null;

  const fieldMap = {
    medicine:    'Medicine',         doctor:      'Medicine',       medical:    'Medicine',
    engineer:    'Engineering / CS', engineering: 'Engineering / CS',
    computer:    'Engineering / CS', software:    'Engineering / CS', coding: 'Engineering / CS',
    business:    'Business',         management:  'Business',       marketing: 'Business', finance: 'Business',
    law:         'Law',              legal:       'Law',
    art:         'Arts & Design',    design:      'Arts & Design',  architecture: 'Arts & Design',
  };
  for (const [key, val] of Object.entries(fieldMap)) {
    if (userText.includes(key)) { field = val; break; }
  }

  if      (userText.includes('baccalaureate') || userText.includes('high school') || userText.includes('lycée') || userText.includes('bac')) level = 'Baccalaureate';
  else if (userText.includes('bachelor')      || userText.includes('licence')     || userText.includes('undergraduate'))                     level = 'Bachelor';
  else if (userText.includes('master')        || userText.includes('graduate'))                                                               level = 'Master';

  const regions = ['casablanca', 'rabat', 'marrakech', 'fes', 'tanger', 'agadir', 'meknes'];
  for (const r of regions) {
    if (userText.includes(r)) { region = r.charAt(0).toUpperCase() + r.slice(1); break; }
  }

  return { fieldOfInterest: field, academicLevel: level, preferredRegion: region };
}

async function generateDynamicQuestion(conversationHistory, collectedInfo, missingField) {
  const missingFieldLabels = {
    fieldOfInterest: 'their field of interest (e.g. Medicine, Engineering, Business, Law, Arts)',
    academicLevel:   'their current academic level (e.g. Baccalaureate, Bachelor, Master)',
    preferredRegion: 'their preferred city in Morocco to study in (e.g. Casablanca, Rabat, Marrakech)',
  };

  const alreadyKnown = Object.entries(collectedInfo)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n') || 'Nothing collected yet.';

  const systemPrompt = `You are a warm, intelligent academic advisor helping Moroccan students find the right educational path.
Your job is to have a natural, engaging conversation to learn about the student.

You already know:
${alreadyKnown}

You still need to find out: ${missingFieldLabels[missingField]}

Rules:
- Ask ONLY about the missing field above — do NOT ask about anything else.
- Make the question feel natural and personal, referencing what the student has already shared.
- Keep it SHORT (1-2 sentences max).
- NEVER use generic phrasing like "What field are you interested in?" — make it specific to this student.
- Respond with ONLY the question, no preamble.`;

  const messages = [
    ...conversationHistory,
    {
      role: 'user',
      content: `Based on our conversation so far, please ask me about ${missingFieldLabels[missingField]}.`,
    },
  ];

  try {
    const response = await getLLMResponse({ systemPrompt, messages });
    return response?.trim() || null;
  } catch (err) {
    console.error('[chatNode] LLM question generation failed:', err);
    // Fallback – still dynamic based on missing field
    const fallbackMap = {
      fieldOfInterest: `What field are you interested in? (Medicine, Engineering, Business, Law, Arts)`,
      academicLevel: `What is your current academic level? (Baccalaureate, Bachelor, Master)`,
      preferredRegion: `Which city in Morocco would you prefer to study in? (e.g., Casablanca, Rabat, Marrakech)`,
    };
    return fallbackMap[missingField] || `Could you tell me more about ${missingField}?`;
  }
}

export async function chatNode(state) {
  const userMessage      = state.payload?.message;
  const previousMessages = state.messages      || [];
  const collectedInfo    = state.collectedInfo  || {};
  const currentPhase     = state.currentPhase   || PHASES.GENERAL;

  if (!userMessage) {
    const welcome = previousMessages.length === 0
      ? "Tell me about yourself: what are you studying, what are you curious about, and what kind of future are you trying to build?"
      : "I'm still here — feel free to continue!";

    return {
      messages:        [{ role: 'assistant', content: welcome }],
      currentPhase,
      collectedInfo,
      profileComplete: false,
      nextQuestion:    welcome,
    };
  }

  const allMessages = [
    ...previousMessages,
    { role: 'user', content: userMessage },
  ];

  const extracted = extractInfo(allMessages);

  const newCollected = {
    ...collectedInfo,
    ...(extracted.fieldOfInterest ? { fieldOfInterest: extracted.fieldOfInterest } : {}),
    ...(extracted.academicLevel   ? { academicLevel:   extracted.academicLevel   } : {}),
    ...(extracted.preferredRegion ? { preferredRegion: extracted.preferredRegion } : {}),
  };

  let nextPhase = currentPhase;
  let missingField = null;
  let isComplete = false;

  if (!newCollected.fieldOfInterest) {
    nextPhase    = PHASES.GENERAL;
    missingField = 'fieldOfInterest';
  } else if (!newCollected.academicLevel) {
    nextPhase    = PHASES.SPECIFIC;
    missingField = 'academicLevel';
  } else if (!newCollected.preferredRegion) {
    nextPhase    = PHASES.FIELD;
    missingField = 'preferredRegion';
  } else {
    nextPhase  = PHASES.PATH;
    isComplete = true;
  }

  const deltaMessages = [{ role: 'user', content: userMessage }];

  if (!isComplete) {
    const nextQuestion = await generateDynamicQuestion(allMessages, newCollected, missingField);
    deltaMessages.push({ role: 'assistant', content: nextQuestion });

    return {
      messages:        deltaMessages,
      collectedInfo:   newCollected,
      currentPhase:    nextPhase,
      profileComplete: false,
      nextQuestion,
    };
  }

  return {
    messages:        deltaMessages,
    collectedInfo:   newCollected,
    currentPhase:    nextPhase,
    profileComplete: true,
    nextQuestion:    '',
  };
}