// agent/nodes/planNode.js
import { generateChatCompletion } from "../../backend/services/groq.service.js";

export async function planNode(state) {
  const { collectedInfo, searchResults } = state;
  
  const planPrompt = `
    You are a Moroccan university admissions advisor. Generate a personalized study plan based on:
    
    Student Profile: ${JSON.stringify(collectedInfo)}
    Search Results: ${JSON.stringify(searchResults)}
    
    Return JSON with: recommendedUniversities, applicationDeadlines, alternativePaths, nextSteps.
  `;
  
  const planResponse = await generateChatCompletion([
    { role: "system", content: "You are a precise Moroccan university admissions advisor. Return only valid JSON." },
    { role: "user", content: planPrompt }
  ], { temperature: 0.5 });
  
  try {
    const studyPlan = JSON.parse(planResponse.replace(/```json\n?/g, "").replace(/```\n?/g, ""));
    return { plan: studyPlan, trace: ["PlanNode: Generated study plan"] };
  } catch (error) {
    return { plan: null, trace: ["PlanNode: Failed to parse plan"] };
  }
}