import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TavilySearch } from "@langchain/tavily";
import { env, hasTavily } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCES_FILE = path.join(__dirname, "../data/knowledge/trusted-opportunity-sources.json");
const TRUSTED_URLS_FILE = path.join(__dirname, "../data/knowledge/trusted_sources.txt");

const tavily = hasTavily
  ? new TavilySearch({
      apiKey: env.TAVILY_API_KEY,
      maxResults: 4,
      includeAnswer: false,
    })
  : null;

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function normalizeArray(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => String(item).split(","))
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hostFromUrl(value = "") {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function readTrustedUrlList() {
  try {
    const content = await fs.readFile(TRUSTED_URLS_FILE, "utf-8");
    return content
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function loadTrustedOpportunitySources() {
  const [sourceContent, trustedUrls] = await Promise.all([
    fs.readFile(SOURCES_FILE, "utf-8"),
    readTrustedUrlList(),
  ]);

  const parsed = JSON.parse(sourceContent);
  const approvedHosts = new Set(trustedUrls.map((url) => hostFromUrl(url)));

  return (Array.isArray(parsed) ? parsed : [])
    .filter((item) => approvedHosts.size === 0 || approvedHosts.has(hostFromUrl(item.url)))
    .map((item) => ({
      ...item,
      host: hostFromUrl(item.url),
    }));
}

function inferTypeFromText(text = "", fallbackType = "project") {
  const hay = normalizeText(text);
  if (hay.includes("intern")) return "internship";
  if (hay.includes("bootcamp")) return "bootcamp";
  if (hay.includes("case")) return "competition";
  if (hay.includes("challenge")) return "challenge";
  if (hay.includes("hack")) return "hackathon";
  if (hay.includes("project")) return "project";
  return fallbackType;
}

function inferMode(text = "") {
  const hay = normalizeText(text);
  if (hay.includes("remote") || hay.includes("online")) return "online";
  if (hay.includes("hybrid")) return "hybrid";
  if (hay.includes("onsite") || hay.includes("on site")) return "onsite";
  return "hybrid";
}

function buildQueries({ career, profile, trustedSources }) {
  const signalTerms = unique([
    career?.title,
    ...(career?.opportunityTags || []),
    ...(career?.roadmapTags || []),
    ...(career?.technicalSkills || []).slice(0, 3),
    ...(profile?.opportunityTypes || []),
    ...(profile?.interests || []).slice(0, 3),
    ...(profile?.strengths || []).slice(0, 2),
  ]);

  return trustedSources.map((source) => ({
    source,
    query: `site:${source.host} ${signalTerms.slice(0, 6).join(" ")} students Morocco`,
  }));
}

function mapRetrievedResultToOpportunity(result, source, career) {
  const title = String(result?.title || "").trim() || `${source.provider} opportunity`;
  const snippet = String(result?.content || result?.snippet || result?.body || "").trim();
  const url = String(result?.url || result?.link || "").trim() || source.url;
  const type = inferTypeFromText(`${title} ${snippet}`, source.defaultType);
  const opportunityTags = unique([
    type,
    ...normalizeArray(source.tags),
    ...normalizeArray(career?.opportunityTags),
    ...normalizeArray(career?.roadmapTags),
  ]).slice(0, 8);

  return {
    id: `trusted-${source.id}-${normalizeText(title).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "result"}`,
    title,
    type,
    provider: source.provider,
    sourceUrl: url,
    location: source.host === "stage.ma" ? "Morocco" : "Remote",
    mode: inferMode(`${title} ${snippet}`),
    deadline: null,
    careerTargets: [career?.id].filter(Boolean),
    skills: unique([
      ...normalizeArray(career?.technicalSkills).slice(0, 4),
      ...normalizeArray(career?.coreSkills).slice(0, 2),
    ]),
    eligibility: ["students"],
    summary: snippet || `Trusted opportunity lead from ${source.provider}.`,
    whyRelevant: "",
    opportunityTags,
    readinessFloor: 1,
    sourceType: "trusted-rag",
    trustScore: source.trustScore,
    retrievalEvidence: {
      sourceId: source.id,
      sourceLabel: source.label,
      matchedQuery: null,
    },
  };
}

export async function retrieveTrustedOpportunityLeads({ career, profile }) {
  const trustedSources = await loadTrustedOpportunitySources();

  if (!trustedSources.length) {
    return {
      opportunities: [],
      retrievalTrace: ["OpportunityRAG: no trusted source definitions available"],
    };
  }

  if (!tavily) {
    return {
      opportunities: [],
      retrievalTrace: [
        `OpportunityRAG: trusted sources loaded -> ${trustedSources.length}`,
        "OpportunityRAG: Tavily unavailable, skipping live trusted retrieval",
      ],
    };
  }

  const queries = buildQueries({ career, profile, trustedSources });
  const collected = [];
  const retrievalTrace = [`OpportunityRAG: trusted sources loaded -> ${trustedSources.length}`];

  for (const { source, query } of queries) {
    try {
      const raw = await tavily.invoke({ query });
      const results = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
      const trustedOnly = results.filter((item) => hostFromUrl(item?.url || item?.link || "") === source.host);

      retrievalTrace.push(`OpportunityRAG: ${source.host} returned ${trustedOnly.length} trusted hits`);

      collected.push(
        ...trustedOnly.map((item) => {
          const normalized = mapRetrievedResultToOpportunity(item, source, career);
          normalized.retrievalEvidence.matchedQuery = query;
          return normalized;
        }),
      );
    } catch (error) {
      retrievalTrace.push(`OpportunityRAG: ${source.host} retrieval failed (${error.message})`);
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of collected) {
    const key = `${normalizeText(item.title)}:${hostFromUrl(item.sourceUrl)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  retrievalTrace.push(`OpportunityRAG: normalized trusted leads -> ${deduped.length}`);

  return {
    opportunities: deduped,
    retrievalTrace,
  };
}
