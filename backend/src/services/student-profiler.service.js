function normalizeText(value = "") {
  return String(value).toLowerCase().trim();
}

function containsOne(text, candidates = []) {
  return candidates.find((item) => text.includes(item)) || null;
}

function extractBudget(text) {
  const match = text.match(/(\d{4,6})\s*(dh|mad|dirham)/i);
  if (!match) return null;
  return Number(match[1]);
}

function extractScore(text, hints) {
  for (const { words, value } of hints) {
    if (words.some((w) => text.includes(w))) return value;
  }
  return null;
}export function buildStudentProfile(messages = [], previous = {}) {
  const text = messages
    .filter((m) => m.role === "user")
    .map((m) => normalizeText(m.content))
    .join(" ");

  const fieldMap = {
    medicine: ["médecine", "medecine", "medicine", "doctor", "médecin"],
    engineering: ["ingénierie", "ingenierie", "engineering", "informatique", "software", "développeur", "developer", "computer science", "ia", "ai"],
    business: ["commerce", "business", "management", "finance", "marketing", "entrepreneuriat", "entrepreneur"],
    law: ["droit", "law", "juridique"],
    arts: ["art", "design", "architecture", "cinéma", "cinema", "audiovisuel"],
  };

  const levelMap = {
    baccalaureate: ["bac", "baccalauréat", "baccalaureat", "terminale", "2bac"],
    bachelor: ["licence", "bachelor", "deug", "dut", "ts"],
    master: ["master", "mastère", "mastere", "mba"],
  }; const regionMap = {
    casablanca: ["casablanca", "casa"],
    rabat: ["rabat", "salé", "sale"],
    marrakech: ["marrakech", "kech"],
    fes: ["fès", "fes"],
    tanger: ["tanger", "طنجة"],
    agadir: ["agadir"],
    oujda: ["oujda"],
    meknes: ["meknès", "meknes"],
  };

  const languageMap = {
    fr: ["français", "francais", "french"],
    en: ["anglais", "english"],
    ar: ["arabe", "arabic"],
  };
 const institutionTypeMap = {
    public: ["public", "publique"],
    private: ["privé", "prive", "private"],
    any: ["peu importe", "any", "n'importe"],
  };

  let fieldOfInterest = previous.fieldOfInterest || null;
  let academicLevel = previous.academicLevel || null;
  let preferredRegion = previous.preferredRegion || null;
  let preferredLanguage = previous.preferredLanguage || null;
  let institutionType = previous.institutionType || null;

  for (const [key, words] of Object.entries(fieldMap)) {
    if (!fieldOfInterest && containsOne(text, words)) fieldOfInterest = key;
  }

  for (const [key, words] of Object.entries(levelMap)) {
    if (!academicLevel && containsOne(text, words)) academicLevel = key;
  }

  for (const [key, words] of Object.entries(regionMap)) {
    if (!preferredRegion && containsOne(text, words)) preferredRegion = key;
  } for (const [key, words] of Object.entries(languageMap)) {
    if (!preferredLanguage && containsOne(text, words)) preferredLanguage = key;
  }

  for (const [key, words] of Object.entries(institutionTypeMap)) {
    if (!institutionType && containsOne(text, words)) institutionType = key;
  }

  const budgetMAD = previous.budgetMAD || extractBudget(text) || null;

  const academicConfidence = previous.academicConfidence ?? extractScore(text, [
    { words: ["très bon", "excellent", "major", "16/20", "17/20", "18/20"], value: 5 },
    { words: ["bon niveau", "bien", "14/20", "15/20"], value: 4 },
    { words: ["moyen", "acceptable", "12/20", "13/20"], value: 3 },
    { words: ["faible", "difficile", "10/20", "11/20"], value: 2 },
  ]) ?? 3;
 const psychologicalReadiness = previous.psychologicalReadiness ?? extractScore(text, [
    { words: ["motivé", "motivée", "confiant", "confiante", "ambitieux", "ambitieuse"], value: 5 },
    { words: ["stressé", "stressée", "anxieux", "anxieuse", "perdu", "perdue"], value: 2 },
    { words: ["je ne sais pas", "indécis", "indecis", "hésite", "hesite"], value: 2 },
  ]) ?? 3;

  const familySupport = previous.familySupport ?? extractScore(text, [
    { words: ["mes parents soutiennent", "famille soutient", "encouragé"], value: 5 },
    { words: ["pas de soutien", "famille refuse", "pression familiale"], value: 2 },
  ]) ?? 3;

  const mobility = previous.mobility ?? extractScore(text, [
    { words: ["je peux déménager", "je peux bouger", "n'importe quelle ville"], value: 5 },
    { words: ["je dois rester", "pas loin", "je préfère rester"], value: 2 },
  ]) ?? 3;

  const riskTolerance = previous.riskTolerance ?? extractScore(text, [
    { words: ["concours difficile", "très sélectif", "je suis prêt à tenter"], value: 5 },
    { words: ["je veux quelque chose de sûr", "sans risque", "garanti"], value: 2 },
  ]) ?? 3;const constraints = Array.from(new Set([
    text.includes("travail") || text.includes("job") ? "needs_flexible_schedule" : null,
    text.includes("transport") ? "transport_sensitive" : null,
    text.includes("handicap") ? "accessibility_needed" : null,
    text.includes("bourse") ? "needs_scholarship" : null,
  ].filter(Boolean)));

  const missing = [
    !fieldOfInterest ? "fieldOfInterest" : null,
    !academicLevel ? "academicLevel" : null,
    !preferredRegion ? "preferredRegion" : null,
    !preferredLanguage ? "preferredLanguage" : null,
    !institutionType ? "institutionType" : null,
    !budgetMAD ? "budgetMAD" : null,
  ].filter(Boolean);

  const completenessScore = Math.max(0, 100 - missing.length * 12);

  return {
    fieldOfInterest,
    academicLevel,
    preferredRegion,
    preferredLanguage,
    institutionType,
    budgetMAD,
    academicConfidence,
    psychologicalReadiness,
    familySupport,
    mobility,
    riskTolerance,
    constraints,
    missing,
    completenessScore,
  };
}export function getProfileSummary(profile) {
  return {
    studyField: profile.fieldOfInterest,
    level: profile.academicLevel,
    cityPreference: profile.preferredRegion,
    budgetMAD: profile.budgetMAD,
    readinessBand:
      profile.psychologicalReadiness >= 4 && profile.academicConfidence >= 4
        ? "strong"
        : profile.psychologicalReadiness <= 2 || profile.academicConfidence <= 2
          ? "fragile"
          : "moderate",
  };
}