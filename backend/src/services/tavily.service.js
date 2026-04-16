// backend/services/tavily.service.js
import { TavilySearchResults } from "@langchain/tavily";

const tavilyTool = new TavilySearchResults({
  apiKey: process.env.TAVILY_API_KEY,
  maxResults: 5,
});

export async function searchUniversities(query) {
  try {
    const results = await tavilyTool.invoke(query);
    return results;
  } catch (error) {
    console.error("Tavily search error:", error);
    return [];
  }
}