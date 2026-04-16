// agent/nodes/planNode.js
// LangGraph node for building career/study plan

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

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(","))
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || "").trim();
}

export async function planNode(state) {
  const careers = await readJson(CAREERS_PATH);
  const opportunities = await readJson(OPPORTUNITIES_PATH);
  const payload = state.payload || {};
  const profile = state.profile;
  const ragContext = state.ragContext || [];

  const selectedId = payload.selectedCareerId || payload.selectedPath || payload.careerId;
  const selectedCareer = careers.find(
    (career) => career.id === selectedId || career.title.toLowerCase() === String(selectedId || "").toLowerCase(),
  ) || careers[0];

  const preferredTypes = normalizeArray(payload.opportunityTypes || profile.opportunityTypes);
  const preferredLocation = normalizeText(payload.preferredLocation || profile.preferredLocation || "remote").toLowerCase();

  let filteredOpportunities = opportunities
    .filter((item) => {
      const typeOk = preferredTypes.length ? preferredTypes.includes(String(item.type).toLowerCase()) : true;
      const locationOk = preferredLocation ? item.location.toLowerCase() === preferredLocation || item.location.toLowerCase() === "flexible" : true;
      const tagOk = item.tags.some((tag) => selectedCareer.tags.includes(tag));
      return typeOk && locationOk && tagOk;
    })
    .slice(0, 5);

  let ragEnhancedExplanation = "";
  if (ragContext.length > 0) {
    ragEnhancedExplanation = `\n\nAdditional context from knowledge base: ${ragContext.map(c => c.content).join(" ").substring(0, 500)}`;
  }

  const plan = {
    selectedPath: {
      id: selectedCareer.id,
      title: selectedCareer.title,
      shortDescription: selectedCareer.shortDescription,
    },
    roadmap: {
      first30Days: selectedCareer.roadmap.first30Days,
      next60Days: selectedCareer.roadmap.next60Days,
      next90Days: selectedCareer.roadmap.next90Days,
    },
    recommendedOpportunities: filteredOpportunities,
    explanation: `This plan focuses on ${selectedCareer.title} because it aligns with your strongest signals and keeps the next steps concrete.${ragEnhancedExplanation}`,
  };

  return {
    plan,
    trace: [
      `PlannerAgent: built a 30-60-90 day roadmap for ${selectedCareer.title}`,
      `OpportunitiesAgent: found ${filteredOpportunities.length} matching opportunities`,
      ragContext.length ? `RAGAgent: enriched plan with ${ragContext.length} external documents` : null,
    ].filter(Boolean),
  };
}