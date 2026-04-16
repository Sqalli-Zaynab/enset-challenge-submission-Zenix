// backend/services/tavily.service.js
const { TavilySearch } = require("@langchain/tavily");

let tavilyTool = null;

function getTavilyTool() {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is missing");
  }

  if (!tavilyTool) {
    tavilyTool = new TavilySearch({
      apiKey: process.env.TAVILY_API_KEY,
      maxResults: 5,
    });
  }

  return tavilyTool;
}

async function searchUniversities(query) {
  try {
    const tool = getTavilyTool();
    const results = await tool.invoke(query);
    return results;
  } catch (error) {
    console.error("Tavily search error:", error);
    return [];
  }
}

module.exports = {
  searchUniversities,
};