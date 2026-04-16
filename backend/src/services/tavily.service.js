import { TavilySearchResults } from "@langchain/tavily";

const tavily = new TavilySearchResults({
  apiKey: process.env.TAVILY_API_KEY,
  maxResults: 10,
  includeAnswer: true,
});

export async function searchMoroccanUniversities(query) {
  try {
    const results = await tavily.invoke(query);
    return results.map(r => ({ title: r.title, url: r.url, content: r.content }));
  } catch (error) {
    console.error("Tavily error:", error);
    return [];
  }
}