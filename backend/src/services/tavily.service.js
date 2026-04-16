import { TavilySearch } from "@langchain/tavily";
import { env, hasTavily } from "../config/env.js";
import {
  normalizeSearchResults,
  dedupeSources,
  rankSources,
} from "./search-ranking.service.js";

const tavily = hasTavily
  ? new TavilySearch({
      apiKey: env.TAVILY_API_KEY,
      maxResults: 6,
      includeAnswer: true,
    })
  : null;

function buildQueries(profile) {
  const field = profile.fieldOfInterest || "higher education";
  const city = profile.preferredRegion || "Morocco";
  const type = profile.institutionType || "any";
  const language = profile.preferredLanguage || "fr";

  return [
    `${field} ${city} Maroc université site officiel admission`,
    `${field} ${city} Maroc école ${type} inscription`,
    `${field} ${city} Maroc programme ${language} site officiel`,
  ];
}

export async function searchMoroccanUniversitiesForProfile(profile) {
  const queries = buildQueries(profile);

  if (!tavily) {
    return {
      isMock: true,
      queries,
      results: rankSources(
        [
          {
            id: "mock_1",
            title: `Mock result for ${profile.fieldOfInterest || "student path"}`,
            url: "https://example.com/mock-university",
            snippet: "Mock result. Configure TAVILY_API_KEY for real-time search.",
            score: 1,
            official: false,
            sourceType: "web_source",
          },
        ],
        profile,
      ),
    };
  }

  let merged = [];

  for (const query of queries) {
    try {
      const raw = await tavily.invoke({ query });
      const normalized = normalizeSearchResults(raw).map((item) => ({
        ...item,
        sourceType: "web_source",
      }));
      merged.push(...normalized);
    } catch (error) {
      console.error("Tavily search error:", error.message);
    }
  }

  const deduped = dedupeSources(merged);
  const ranked = rankSources(deduped, profile).slice(0, 8);

  return {
    isMock: false,
    queries,
    results: ranked,
  };
}

export async function searchMoroccanUniversities(profile) {
  return searchMoroccanUniversitiesForProfile(profile);
}