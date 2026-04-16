import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "../../data/knowledge/morocco-universities.json");

function normalize(value = "") {
  return String(value).toLowerCase().trim();
}

function mapRiskToLabel(score) {
  if (score == null) return "balanced";
  if (score <= 2) return "safe";
  if (score >= 4) return "ambitious";
  return "balanced";
}

function approximateBudgetBand(budgetMAD) {
  if (budgetMAD == null) return "unknown";
  if (budgetMAD <= 15000) return "low";
  if (budgetMAD <= 40000) return "medium";
  return "high";
}

async function loadKnowledge() {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export async function retrieveTrustedKnowledge(profile = {}) {
  const items = await loadKnowledge();
  const wantedField = normalize(profile.fieldOfInterest || "");
  const wantedCity = normalize(profile.preferredRegion || "");
  const wantedType = normalize(profile.institutionType || "any");
  const wantedLanguage = normalize(profile.preferredLanguage || "");
  const budgetBand = approximateBudgetBand(profile.budgetMAD);
  const riskLabel = mapRiskToLabel(profile.riskTolerance);

  const ranked = items
    .map((item, index) => {
      let score = 0;
      const itemFieldTags = Array.isArray(item.fieldTags) ? item.fieldTags.map(normalize) : [];
      const itemType = normalize(item.type || "");
      const itemCity = normalize(item.city || "");
      const itemLang = normalize(item.language || "");
      const itemBudgetBand = normalize(item.budgetBand || "unknown");
      const itemRiskBand = normalize(item.riskBand || "balanced");

      if (
        wantedField &&
        itemFieldTags.some((tag) => tag.includes(wantedField) || wantedField.includes(tag))
      ) {
        score += 4;
      }
      if (wantedCity && itemCity.includes(wantedCity)) score += 3;
      if (wantedType && wantedType !== "any" && itemType === wantedType) score += 2;
      if (wantedLanguage && itemLang === wantedLanguage) score += 1;
      if (budgetBand !== "unknown" && itemBudgetBand === budgetBand) score += 2;
      if (itemRiskBand === riskLabel) score += 1;

      return {
        id: `trusted_${index + 1}`,
        title: item.name,
        url: item.officialUrl,
        snippet: item.description || "Trusted local knowledge source.",
        city: item.city,
        official: true,
        score,
        qualityScore: score + 5,
        sourceType: "trusted_source",
        program: item.program || null,
        type: item.type || null,
        language: item.language || null,
      };
    })
    .filter((item) => item.url)
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 6);

  return ranked;
}