import { searchMoroccanUniversities } from "../../backend/src/services/tavily.service.js";

export async function searchNode(state) {
  const { fieldOfInterest, preferredRegion = "Morocco" } = state.collectedInfo;
  if (!fieldOfInterest) return { searchResults: [], trace: ["No field"] };
  const query = `${fieldOfInterest} programs in ${preferredRegion} Moroccan university admission requirements`;
  const results = await searchMoroccanUniversities(query);
  return { searchResults: results, trace: [`Found ${results.length} results`] };
}