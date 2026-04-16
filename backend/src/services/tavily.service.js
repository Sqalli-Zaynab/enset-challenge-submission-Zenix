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
  const level = profile.academicLevel || "student";
  const language = profile.preferredLanguage || "fr";
  const institutionType = profile.institutionType || "any";

  return [
    `${field} ${city} Maroc université admission site officiel`,
    `${field} ${city} Maroc concours inscription frais ${institutionType}`,
    `${field} ${level} ${city} Maroc études ${language} université`,
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
      merged.push(...normalizeSearchResults(raw));
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