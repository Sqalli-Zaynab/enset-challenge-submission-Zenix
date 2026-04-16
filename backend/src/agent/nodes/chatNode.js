// backend/src/agent/nodes/chatNode.js

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

export async function chatNode(state) {
  // Read the current user message from payload (set by chat.routes.js → runAgentGraph).
  // state.payload.message is the ONLY new input for this turn; everything else
  // (messages, collectedInfo, currentPhase) is restored from the MemorySaver checkpoint.
  const userMessage      = state.payload?.message;

  // MemorySaver has already restored the full conversation history into state.messages,
  // so previousMessages is the accumulated transcript up to (but not including) this turn.
  const previousMessages = state.messages      || [];
  const collectedInfo    = state.collectedInfo  || {};
  const currentPhase     = state.currentPhase   || PHASES.GENERAL;

  // --- Guard: no user message received ---
  // This happens on the very first call (welcome) OR if the frontend sends an empty body.
  // FIX: Instead of one hard-coded welcome, pick the appropriate prompt based on phase
  // so that a missing message on a later turn doesn't reset the conversation to the start.
  if (!userMessage) {
    let welcome;
    if (previousMessages.length === 0) {
      welcome = "Tell me about yourself: what are you studying, what are you curious about, and what kind of future are you trying to understand?";
    } else if (currentPhase === PHASES.GENERAL) {
      welcome = 'What field are you interested in? (Medicine, Engineering, Business, Law, Arts)';
    } else if (currentPhase === PHASES.SPECIFIC) {
      welcome = 'What is your current academic level? (Baccalaureate, Bachelor, Master)';
    } else if (currentPhase === PHASES.FIELD) {
      welcome = 'Which city in Morocco would you prefer to study in? (e.g., Casablanca, Rabat, Marrakech)';
    } else {
      welcome = 'Please continue — I\'m here to help.';
    }

    // Return ONLY the delta (the new assistant message).
    // The concat reducer in State accumulates it into the full history automatically.
    return {
      messages:        [{ role: 'assistant', content: welcome }],
      currentPhase,
      collectedInfo,
      profileComplete: false,
      nextQuestion:    welcome,
    };
  }

  // Build the full message list for extraction (previous turns + this user turn).
  // We need the whole history so extractInfo can see everything the user has said.
  const allMessages = [
    ...previousMessages,
    { role: 'user', content: userMessage },
  ];

  // Extract info from the complete conversation history.
  const extracted = extractInfo(allMessages);

  // FIX: Merge into collectedInfo using the ALREADY-PERSISTED values as base.
  // Only overwrite a field if extraction found something NEW; otherwise keep the
  // previously checkpointed value so progress is never lost between turns.
  const newCollected = {
    ...collectedInfo,
    ...(extracted.fieldOfInterest ? { fieldOfInterest: extracted.fieldOfInterest } : {}),
    ...(extracted.academicLevel   ? { academicLevel:   extracted.academicLevel   } : {}),
    ...(extracted.preferredRegion ? { preferredRegion: extracted.preferredRegion } : {}),
  };

  let nextPhase    = currentPhase;
  let nextQuestion = '';
  let isComplete   = false;

  // Phase transition logic
  if (currentPhase === PHASES.GENERAL && newCollected.fieldOfInterest) {
    nextPhase    = PHASES.SPECIFIC;
    nextQuestion = `Great! You're interested in ${newCollected.fieldOfInterest}. What is your current academic level? (Baccalaureate, Bachelor, Master)`;
  } else if (currentPhase === PHASES.SPECIFIC && newCollected.academicLevel) {
    nextPhase    = PHASES.FIELD;
    nextQuestion = `Thanks. Which city in Morocco would you prefer to study in? (e.g., Casablanca, Rabat, Marrakech)`;
  } else if (currentPhase === PHASES.FIELD && newCollected.preferredRegion) {
    nextPhase  = PHASES.PATH;
    isComplete = true;
  } else if (currentPhase === PHASES.GENERAL && !newCollected.fieldOfInterest) {
    nextQuestion = 'What field are you interested in? (Medicine, Engineering, Business, Law, Arts)';
  } else if (currentPhase === PHASES.SPECIFIC && !newCollected.academicLevel) {
    nextQuestion = 'What is your current academic level? (Baccalaureate, Bachelor, Master)';
  } else if (currentPhase === PHASES.FIELD && !newCollected.preferredRegion) {
    nextQuestion = 'Which city in Morocco do you prefer?';
  } else {
    // Fallback: ask for the first missing piece
    if      (!newCollected.fieldOfInterest) nextQuestion = 'What field interests you?';
    else if (!newCollected.academicLevel)   nextQuestion = 'What is your academic level?';
    else if (!newCollected.preferredRegion) nextQuestion = 'Which city in Morocco?';
    else isComplete = true;
  }

  // FIX: Return ONLY the delta — the new user message and the new assistant reply.
  // DO NOT spread previousMessages here; the concat reducer handles accumulation.
  // Returning the full array would double every prior message on the next turn.
  const deltaMessages = [{ role: 'user', content: userMessage }];
  if (!isComplete && nextQuestion) {
    deltaMessages.push({ role: 'assistant', content: nextQuestion });
  }

  return {
    messages:        deltaMessages,  // ← delta only, NOT the full array
    collectedInfo:   newCollected,
    currentPhase:    nextPhase,
    profileComplete: isComplete,
    nextQuestion:    isComplete ? '' : nextQuestion,
  };
}