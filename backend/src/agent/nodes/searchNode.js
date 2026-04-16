// agent/nodes/searchNode.js
import { searchUniversities } from "../../backend/services/tavily.service.js";

export async function searchNode(state) {
  const { fieldOfInterest, preferredRegion = "Morocco" } = state.collectedInfo;
  
  if (!fieldOfInterest) {
    return { searchResults: [], trace: ["SearchNode: No field provided"] };
  }
  
  const query = `${fieldOfInterest} programs in ${preferredRegion} admission requirements Moroccan university`;
  const searchResults = await searchUniversities(query);
  
  return {
    searchResults,
    trace: [`SearchNode: Found ${searchResults.length} results for "${fieldOfInterest}"`],
  };
}