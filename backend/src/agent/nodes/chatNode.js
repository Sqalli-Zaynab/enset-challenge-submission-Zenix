import { generateChatCompletion } from "../../backend/src/services/groq.service.js";

const PHASES = { GENERAL: "general", SPECIFIC: "specific", FIELD: "field", PATH: "path" };

export async function chatNode(state) {
  const userMessage = state.payload?.message;
  const messages = state.messages || [];
  const collectedInfo = state.collectedInfo || {};
  let currentPhase = state.currentPhase || PHASES.GENERAL;

  const updatedMessages = [...messages, { role: "user", content: userMessage }];

  if (updatedMessages.length === 1 && !userMessage) {
    const welcome = "Hi! I'm your Moroccan university advisor. Tell me about yourself – what do you enjoy doing? Any hobbies or subjects you love?";
    return {
      messages: [...updatedMessages, { role: "assistant", content: welcome }],
      currentPhase: PHASES.GENERAL,
      profileComplete: false,
      nextQuestion: welcome,
    };
  }

  const analysisPrompt = `
    Analyze this conversation and decide the next step.
    Phases: general (broad interests) → specific (drill down) → field (confirm exact field) → path (ready to search).
    Extract info: interests, skills, academicLevel, preferredRegion, fieldOfInterest.
    Transition: general→specific after a clear interest; specific→field after enough detail; field→path when field, level, region known.
    Return JSON: { "collectedInfo": {...}, "nextPhase": "...", "nextQuestion": "...", "isComplete": bool }
    Conversation: ${updatedMessages.map(m => `${m.role}: ${m.content}`).join("\n")}
  `;

  let nextPhase = currentPhase, nextQuestion = "", isComplete = false, extracted = {};
  try {
    const response = await generateChatCompletion([
      { role: "system", content: "You are a precise analyzer. Return only JSON." },
      { role: "user", content: analysisPrompt }
    ], { temperature: 0.6 });
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    const result = JSON.parse(cleaned);
    extracted = result.collectedInfo || {};
    nextPhase = result.nextPhase || currentPhase;
    nextQuestion = result.nextQuestion || "";
    isComplete = result.isComplete || (nextPhase === PHASES.PATH);
  } catch (e) {
    // fallback manual progression
    if (currentPhase === PHASES.GENERAL && Object.keys(collectedInfo).length > 0) nextPhase = PHASES.SPECIFIC;
    else if (currentPhase === PHASES.SPECIFIC && collectedInfo.fieldOfInterest) nextPhase = PHASES.FIELD;
    else if (currentPhase === PHASES.FIELD && collectedInfo.academicLevel && collectedInfo.preferredRegion) nextPhase = PHASES.PATH;
    if (nextPhase === PHASES.PATH) isComplete = true;
    else nextQuestion = "Could you tell me more?";
  }

  const newCollected = { ...collectedInfo, ...extracted };
  const finalMessages = [...updatedMessages];
  if (!isComplete && nextQuestion) finalMessages.push({ role: "assistant", content: nextQuestion });

  return {
    messages: finalMessages,
    collectedInfo: newCollected,
    currentPhase: nextPhase,
    profileComplete: isComplete,
    nextQuestion: isComplete ? "" : nextQuestion,
  };
}