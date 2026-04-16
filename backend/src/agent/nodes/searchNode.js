// agent/nodes/searchNode.js
import tavilyService from "../../services/tavily.service.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CAREERS_PATH = path.join(__dirname, "..", "..", "data", "careers.json");
const OPPORTUNITIES_PATH = path.join(__dirname, "..", "..", "data", "oportunities.json");

async function readJson(filePath) {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

export async function searchNode(state) {
  const { fieldOfInterest = "", preferredRegion = "Morocco" } = state.collectedInfo || {};
  
  if (!fieldOfInterest) {
    return { searchResults: [], trace: ["SearchNode: No field provided"] };
  }

  const query = `${fieldOfInterest} programs in ${preferredRegion} admission requirements scholarships deadlines`;

  let searchResults = [];
  try {
    if (process.env.TAVILY_API_KEY) {
      const remote = await tavilyService.searchUniversities(query);
      if (Array.isArray(remote) && remote.length) {
        searchResults = remote.map((item) => ({
          type: "web_result",
          title: item.title || item.url || "Search result",
          source: item.url || "Tavily",
          snippet: item.content || item.snippet || "",
        }));
      }
    }
  } catch {
    searchResults = [];
  }

  if (!searchResults.length) {
    const [careers, opportunities] = await Promise.all([
      readJson(CAREERS_PATH),
      readJson(OPPORTUNITIES_PATH),
    ]);

    const keyword = fieldOfInterest.toLowerCase();

    const careerMatches = careers
      .filter((career) =>
        career.title.toLowerCase().includes(keyword) ||
        (career.tags || []).some((tag) => String(tag).toLowerCase().includes(keyword)),
      )
      .slice(0, 3)
      .map((career) => ({
        type: "career_path",
        title: career.title,
        source: `Local career dataset (${preferredRegion})`,
        snippet: career.shortDescription,
      }));

    const opportunityMatches = opportunities
      .filter((item) =>
        String(item.title || "").toLowerCase().includes(keyword) ||
        (item.tags || []).some((tag) => String(tag).toLowerCase().includes(keyword)),
      )
      .slice(0, 3)
      .map((item) => ({
        type: "opportunity",
        title: item.title,
        source: `Local opportunities dataset (${preferredRegion})`,
        snippet: item.description,
      }));

    searchResults = [...careerMatches, ...opportunityMatches];
  }
  
  return {
    searchResults,
    trace: [`SearchNode: Found ${searchResults.length} results for "${fieldOfInterest}"`],
  };
}