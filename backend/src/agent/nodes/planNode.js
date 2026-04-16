import { generateChatCompletion } from "../../backend/src/services/groq.service.js";

export async function planNode(state) {
  const { collectedInfo, searchResults } = state;
  if (!searchResults.length) return { plan: null };
  const prompt = `
    Using ONLY these search results, create a JSON study plan for a Moroccan student:
    Profile: ${JSON.stringify(collectedInfo)}
    Results: ${JSON.stringify(searchResults)}
    Output: { "recommendedUniversities": [{"name","program","admissionRequirements","location"}], "applicationDeadlines": [], "nextSteps": [] }
  `;
  const response = await generateChatCompletion([{ role: "user", content: prompt }], { temperature: 0.3 });
  const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  const plan = JSON.parse(cleaned);
  return { plan, trace: ["Plan generated"] };
}