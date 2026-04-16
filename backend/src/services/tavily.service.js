import { TavilySearch } from "@langchain/tavily";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

let tavily;
const apiKey = process.env.TAVILY_API_KEY;
if (apiKey) {
  try {
    tavily = new TavilySearch({ apiKey, maxResults: 5, includeAnswer: true });
  } catch (e) {
    console.warn("Tavily init error:", e.message);
  }
} else {
  console.warn("⚠️ TAVILY_API_KEY not found. Using mock search results.");
}

export async function searchMoroccanUniversities(query) {
  if (!tavily) {
    console.log("Mock Tavily search for:", query);
    return [
      { title: "Mock University of Casablanca", url: "https://example.com", content: "This is a mock result. Please set TAVILY_API_KEY." }
    ];
  }
  try {
    const results = await tavily.invoke({ query });
    return results;
  } catch (error) {
    console.error("Tavily search error:", error);
    return [];
  }
}