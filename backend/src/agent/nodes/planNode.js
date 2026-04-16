// agent/nodes/planNode.js
import groqService from "../../services/groq.service.js";
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

export async function planNode(state) {
  if (state.mode === "chat") {
    const collectedInfo = state.collectedInfo || {};
    const searchResults = state.searchResults || [];

    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error("Missing GROQ_API_KEY");
      }

      const prompt = [
        "You are a Moroccan university admissions advisor.",
        `Student info: ${JSON.stringify(collectedInfo)}`,
        `Web/data search context: ${JSON.stringify(searchResults).slice(0, 8000)}`,
        "Return ONLY valid JSON with keys: recommendedUniversities (array of {name,reason,source}), applicationDeadlines (array of strings), alternativePaths (array of strings), nextSteps (array of strings).",
      ].join("\n");

      const raw = await groqService.generateChatCompletion([
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: prompt },
      ], { temperature: 0.3, max_tokens: 800 });

      const parsed = JSON.parse(String(raw).replace(/```json\n?/g, "").replace(/```\n?/g, ""));
      return {
        plan: parsed,
        trace: [
          `PlanNode: generated dynamic admissions plan with Groq`,
          `PlanNode: used ${searchResults.length} search results`,
        ],
      };
    } catch {
      return {
        plan: {
          recommendedUniversities: [],
          applicationDeadlines: [],
          alternativePaths: ["Bootcamps", "Online certifications", "Portfolio-based applications"],
          nextSteps: ["Define target program", "Prepare required documents", "Track deadlines"],
        },
        trace: ["PlanNode: fallback admissions plan used (Groq unavailable)"],
      };
    }
  }

  const profile = state.profile || {};
  const selectedCareerId = state.payload?.selectedCareerId;

  const [careers, opportunities] = await Promise.all([
    readJson(CAREERS_PATH),
    readJson(OPPORTUNITIES_PATH),
  ]);

  const selectedCareer =
    careers.find((career) => career.id === selectedCareerId) ||
    careers.find((career) => (state.scoredCareers || []).some((item) => item.id === career.id)) ||
    careers[0];

  const allowedTypes = new Set((selectedCareer.recommendedOpportunities || []).map((item) => String(item).toLowerCase()));
  const preferredLocation = String(profile.preferredLocation || "").toLowerCase();

  const recommendedOpportunities = opportunities
    .filter((item) => {
      const type = String(item.type || "").toLowerCase();
      const location = String(item.location || "").toLowerCase();
      const locationMatch = !preferredLocation || preferredLocation === location || location === "remote";
      return allowedTypes.has(type) && locationMatch;
    })
    .slice(0, 4);

  const plan = {
    selectedPath: {
      id: selectedCareer.id,
      title: selectedCareer.title,
      shortDescription: selectedCareer.shortDescription,
    },
    roadmap: selectedCareer.roadmap,
    recommendedOpportunities,
    explanation: `This path was selected based on your interests (${(profile.interests || []).slice(0, 2).join(", ") || "your profile"}), strengths, readiness level, and preferred opportunity formats.`,
  };

  return {
    plan,
    trace: [
      `PlanAgent: selected path -> ${selectedCareer.id}`,
      `PlanAgent: matched ${recommendedOpportunities.length} opportunities`,
    ],
  };
}