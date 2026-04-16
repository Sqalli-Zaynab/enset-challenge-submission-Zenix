// agent/nodes/chatNode.js
// Conversational node that asks sequential questions to build a rich user profile

import { generateChatCompletion } from "../../backend/services/groq.service.js";

// Define the list of questions to ask (order matters)
const INTERVIEW_QUESTIONS = [
  "What is your academic level? (e.g., Baccalaureate, Bachelor's, Master's, or other)",
  "Which fields of study interest you the most? (e.g., Computer Science, Medicine, Engineering, Business, Arts)",
  "Do you have a preferred region or city in Morocco to study? (e.g., Casablanca, Rabat, Marrakech, Fes, or anywhere)",
  "What languages are you most comfortable studying in? (French, English, Arabic, or others)",
  "What are your main career goals or dream job after graduation?",
  "Do you have any specific university in mind, or would you like recommendations?",
];

export async function chatNode(state) {
  const userMessage = state.payload?.message;
  const messages = state.messages || [];
  const collectedInfo = state.collectedInfo || {};
  
  // Append user message to history
  const updatedMessages = [...messages, { role: "user", content: userMessage }];
  
  // Determine current question index (based on answers collected)
  let currentStep = Object.keys(collectedInfo).length;
  // If we already have answers for all questions, mark profile complete
  const profileComplete = currentStep >= INTERVIEW_QUESTIONS.length;
  
  let nextQuestion = "";
  let updatedInfo = { ...collectedInfo };
  
  if (!profileComplete && userMessage) {
    // Store the user's answer for the current question
    const currentQuestion = INTERVIEW_QUESTIONS[currentStep];
    updatedInfo[`q${currentStep + 1}`] = {
      question: currentQuestion,
      answer: userMessage,
    };
    
    // Move to next step
    currentStep++;
  }
  
  // If still not complete, generate the next question
  if (currentStep < INTERVIEW_QUESTIONS.length) {
    nextQuestion = INTERVIEW_QUESTIONS[currentStep];
  } else {
    // All questions answered → use Groq to extract structured profile from all answers
    const extractionPrompt = `
      You are a Moroccan university admissions advisor. Extract structured information from the following student interview answers.
      
      Interview Answers:
      ${JSON.stringify(updatedInfo, null, 2)}
      
      Return a JSON object with these fields (use null if not mentioned):
      - fieldOfInterest (string, primary field the student wants to study)
      - academicLevel (string, e.g., Baccalaureate, Bachelor, Master)
      - preferredRegion (string, city or region in Morocco)
      - languagePreference (string, French, English, or Arabic)
      - careerGoal (string, dream job or career objective)
      - targetUniversity (string, specific university if mentioned, else null)
      
      ONLY return valid JSON, no other text.
    `;
    
    try {
      const extractedJson = await generateChatCompletion([
        { role: "system", content: "You are a precise data extraction assistant." },
        { role: "user", content: extractionPrompt }
      ], { temperature: 0.1 });
      
      const cleaned = extractedJson.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      const structured = JSON.parse(cleaned);
      
      // Merge structured info into collectedInfo
      updatedInfo.structured = structured;
      
      // Return with profile complete flag and no next question
      const finalMessages = [...updatedMessages];
      return {
        messages: finalMessages,
        collectedInfo: updatedInfo,
        profileComplete: true,
        nextQuestion: "",
        trace: [`ChatNode: Interview complete, extracted profile: ${JSON.stringify(structured)}`],
      };
    } catch (error) {
      console.error("Extraction error:", error);
      // Fallback: still mark complete but without structured extraction
      const finalMessages = [...updatedMessages];
      return {
        messages: finalMessages,
        collectedInfo: updatedInfo,
        profileComplete: true,
        nextQuestion: "",
        trace: [`ChatNode: Interview complete (fallback, no structured extraction)`],
      };
    }
  }
  
  // Add assistant's next question to message history
  const finalMessages = [...updatedMessages, { role: "assistant", content: nextQuestion }];
  
  return {
    messages: finalMessages,
    collectedInfo: updatedInfo,
    profileComplete: false,
    nextQuestion: nextQuestion,
    trace: [`ChatNode: Step ${currentStep + 1}/${INTERVIEW_QUESTIONS.length} - Asked: "${nextQuestion}"`],
  };
}