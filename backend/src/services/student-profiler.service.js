import { extractStructuredInfo } from './llm-extraction.service.js';

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function uniqStrings(values = []) {
  return Array.from(
    new Set(
      values
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value !== 'string') return null;
  const v = normalizeText(value);
  if (['yes', 'true', 'oui', 'possible', 'can', 'y', '1'].includes(v)) return true;
  if (['no', 'false', 'non', 'impossible', 'cannot', 'n', '0'].includes(v)) return false;
  return null;
}

function containsOne(text, candidates = []) {
  return candidates.find((item) => text.includes(item)) || null;
}

function extractBudget(text) {
  const match = text.match(/(\d{4,6})\s*(dh|mad|dirham)/i);
  if (!match) return null;
  return Number(match[1]);
}

function extractAverage(text) {
  const match = text.match(/(\d{1,2}(?:[\.,]\d+)?)\s*\/\s*20/i);
  if (!match) return null;
  return Number(String(match[1]).replace(',', '.'));
}

function extractStringScore(text, rules = []) {
  for (const rule of rules) {
    if (rule.words.some((w) => text.includes(w))) return rule.value;
  }
  return null;
}

function mergeValue(previous, next) {
  if (next === null || next === undefined || next === '') return previous ?? null;
  return next;
}

export function createEmptyStudentProfile() {
  return {
    fieldOfInterest: null,
    careerGoal: null,
    academicLevel: null,
    academicAverage: null,
    academicConfidence: null,
    psychologicalReadiness: null,
    familySupport: null,
    mobility: null,
    riskTolerance: null,
    preferredRegion: null,
    preferredLanguage: null,
    institutionType: null,
    budgetMAD: null,
    financialAidNeeded: null,
    workWhileStudying: null,
    needsFlexibleSchedule: null,
    accessibilityNeeds: null,
    strengths: [],
    interests: [],
    constraints: [],
    evidence: {},
    missing: [],
    completenessScore: 0,
  };
}

export function sanitizeProfileUpdates(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    fieldOfInterest: typeof raw.fieldOfInterest === 'string' ? raw.fieldOfInterest.trim() : null,
    careerGoal: typeof raw.careerGoal === 'string' ? raw.careerGoal.trim() : null,
    academicLevel: typeof raw.academicLevel === 'string' ? raw.academicLevel.trim() : null,
    academicAverage:
      raw.academicAverage !== undefined && raw.academicAverage !== null
        ? Number(raw.academicAverage)
        : null,
    academicConfidence: normalizeScore(raw.academicConfidence),
    psychologicalReadiness: normalizeScore(raw.psychologicalReadiness),
    familySupport: normalizeScore(raw.familySupport),
    mobility: normalizeScore(raw.mobility),
    riskTolerance: normalizeScore(raw.riskTolerance),
    preferredRegion: typeof raw.preferredRegion === 'string' ? raw.preferredRegion.trim() : null,
    preferredLanguage:
      typeof raw.preferredLanguage === 'string' ? raw.preferredLanguage.trim() : null,
    institutionType: typeof raw.institutionType === 'string' ? raw.institutionType.trim() : null,
    budgetMAD:
      raw.budgetMAD !== undefined && raw.budgetMAD !== null ? Number(raw.budgetMAD) : null,
    financialAidNeeded: normalizeBoolean(raw.financialAidNeeded),
    workWhileStudying: normalizeBoolean(raw.workWhileStudying),
    needsFlexibleSchedule: normalizeBoolean(raw.needsFlexibleSchedule),
    accessibilityNeeds: normalizeBoolean(raw.accessibilityNeeds),
    strengths: uniqStrings(Array.isArray(raw.strengths) ? raw.strengths : []),
    interests: uniqStrings(Array.isArray(raw.interests) ? raw.interests : []),
    constraints: uniqStrings(Array.isArray(raw.constraints) ? raw.constraints : []),
    evidence: raw.evidence && typeof raw.evidence === 'object' ? raw.evidence : {},
  };
}

export function mergeStudentProfile(previous = createEmptyStudentProfile(), updates = {}) {
  const next = sanitizeProfileUpdates(updates);
  return {
    ...previous,
    fieldOfInterest: mergeValue(previous.fieldOfInterest, next.fieldOfInterest),
    careerGoal: mergeValue(previous.careerGoal, next.careerGoal),
    academicLevel: mergeValue(previous.academicLevel, next.academicLevel),
    academicAverage: mergeValue(previous.academicAverage, next.academicAverage),
    academicConfidence: mergeValue(previous.academicConfidence, next.academicConfidence),
    psychologicalReadiness: mergeValue(
      previous.psychologicalReadiness,
      next.psychologicalReadiness,
    ),
    familySupport: mergeValue(previous.familySupport, next.familySupport),
    mobility: mergeValue(previous.mobility, next.mobility),
    riskTolerance: mergeValue(previous.riskTolerance, next.riskTolerance),
    preferredRegion: mergeValue(previous.preferredRegion, next.preferredRegion),
    preferredLanguage: mergeValue(previous.preferredLanguage, next.preferredLanguage),
    institutionType: mergeValue(previous.institutionType, next.institutionType),
    budgetMAD: mergeValue(previous.budgetMAD, next.budgetMAD),
    financialAidNeeded: mergeValue(previous.financialAidNeeded, next.financialAidNeeded),
    workWhileStudying: mergeValue(previous.workWhileStudying, next.workWhileStudying),
    needsFlexibleSchedule: mergeValue(
      previous.needsFlexibleSchedule,
      next.needsFlexibleSchedule,
    ),
    accessibilityNeeds: mergeValue(previous.accessibilityNeeds, next.accessibilityNeeds),
    strengths: uniqStrings([...(previous.strengths || []), ...(next.strengths || [])]),
    interests: uniqStrings([...(previous.interests || []), ...(next.interests || [])]),
    constraints: uniqStrings([...(previous.constraints || []), ...(next.constraints || [])]),
    evidence: {
      ...(previous.evidence || {}),
      ...(next.evidence || {}),
    },
  };
}

export function computeMissingDimensions(profile = {}) {
  return [
    !profile.fieldOfInterest ? 'fieldOfInterest' : null,
    !profile.academicLevel ? 'academicLevel' : null,
    profile.academicConfidence == null ? 'academicConfidence' : null,
    !profile.preferredRegion ? 'preferredRegion' : null,
    !profile.preferredLanguage ? 'preferredLanguage' : null,
    !profile.institutionType ? 'institutionType' : null,
    profile.budgetMAD == null ? 'budgetMAD' : null,
    profile.psychologicalReadiness == null ? 'psychologicalReadiness' : null,
    profile.familySupport == null ? 'familySupport' : null,
    profile.mobility == null ? 'mobility' : null,
    profile.riskTolerance == null ? 'riskTolerance' : null,
  ].filter(Boolean);
}

export function finalizeStudentProfile(profile = {}) {
  const merged = {
    ...createEmptyStudentProfile(),
    ...profile,
    strengths: uniqStrings(profile.strengths || []),
    interests: uniqStrings(profile.interests || []),
    constraints: uniqStrings(profile.constraints || []),
  };

  const missing = computeMissingDimensions(merged);
  const completenessScore = Math.max(0, Math.min(100, 100 - missing.length * 8));

  return {
    ...merged,
    missing,
    completenessScore,
  };
}

function fallbackLexicalExtraction(text = '') {
  const fieldMap = {
    medicine: ['medecine', 'medicine', 'doctor', 'medecin'],
    engineering: [
      'ingenierie',
      'engineering',
      'informatique',
      'software',
      'computer science',
      'ai',
      'ia',
      'cyber',
      'reseaux',
    ],
    business: ['commerce', 'business', 'management', 'finance', 'marketing', 'entrepreneur'],
    law: ['droit', 'law', 'juridique'],
    arts: ['art', 'design', 'architecture', 'cinema', 'audiovisuel'],
  };

  const levelMap = {
    baccalaureate: ['bac', 'baccalaureat', '2bac', 'terminale'],
    bachelor: ['licence', 'bachelor', 'deug', 'dut', 'ts'],
    master: ['master', 'mastere', 'mba'],
  };

  const regionMap = {
    casablanca: ['casablanca', 'casa'],
    rabat: ['rabat', 'sale'],
    marrakech: ['marrakech', 'kech'],
    fes: ['fes'],
    tanger: ['tanger'],
    agadir: ['agadir'],
    oujda: ['oujda'],
    meknes: ['meknes'],
  };

  const languageMap = {
    fr: ['francais', 'french'],
    en: ['anglais', 'english'],
    ar: ['arabe', 'arabic'],
  };

  const institutionTypeMap = {
    public: ['public', 'publique'],
    private: ['prive', 'private'],
    any: ['peu importe', 'any', "n'importe"],
  };

  let fieldOfInterest = null;
  let academicLevel = null;
  let preferredRegion = null;
  let preferredLanguage = null;
  let institutionType = null;

  for (const [key, words] of Object.entries(fieldMap)) {
    if (!fieldOfInterest && containsOne(text, words)) fieldOfInterest = key;
  }
  for (const [key, words] of Object.entries(levelMap)) {
    if (!academicLevel && containsOne(text, words)) academicLevel = key;
  }
  for (const [key, words] of Object.entries(regionMap)) {
    if (!preferredRegion && containsOne(text, words)) preferredRegion = key;
  }
  for (const [key, words] of Object.entries(languageMap)) {
    if (!preferredLanguage && containsOne(text, words)) preferredLanguage = key;
  }
  for (const [key, words] of Object.entries(institutionTypeMap)) {
    if (!institutionType && containsOne(text, words)) institutionType = key;
  }

  const academicAverage = extractAverage(text);
  const budgetMAD = extractBudget(text);
  const academicConfidence = extractStringScore(text, [
    { words: ['excellent', 'tres bon', 'major', '16/20', '17/20', '18/20'], value: 5 },
    { words: ['bon niveau', '14/20', '15/20'], value: 4 },
    { words: ['moyen', '12/20', '13/20'], value: 3 },
    { words: ['faible', '10/20', '11/20', 'difficile scolairement'], value: 2 },
  ]);

  const psychologicalReadiness = extractStringScore(text, [
    { words: ['motive', 'confiant', 'ambitieux'], value: 5 },
    { words: ['stresse', 'anxieux', 'perdu', 'burnout'], value: 2 },
    { words: ["j'hesite", 'je ne sais pas', 'indecis'], value: 2 },
  ]);

  const familySupport = extractStringScore(text, [
    { words: ['mes parents soutiennent', 'famille soutient', 'encourage'], value: 5 },
    { words: ['pas de soutien', 'famille refuse', 'pression familiale'], value: 2 },
  ]);

  const mobility = extractStringScore(text, [
    { words: ['je peux demenager', 'je peux bouger', "n'importe quelle ville"], value: 5 },
    { words: ['je dois rester', 'pas loin', 'je prefere rester'], value: 2 },
  ]);

  const riskTolerance = extractStringScore(text, [
    { words: ['tres selectif', 'je suis pret a tenter', 'concours difficile'], value: 5 },
    { words: ['je veux quelque chose de sur', 'sans risque', 'garanti'], value: 2 },
  ]);

  const constraints = uniqStrings([
    text.includes('travail') || text.includes('job') ? 'needs_flexible_schedule' : null,
    text.includes('transport') ? 'transport_sensitive' : null,
    text.includes('handicap') ? 'accessibility_needed' : null,
    text.includes('bourse') ? 'needs_scholarship' : null,
  ]);

  const financialAidNeeded = text.includes('bourse') ? true : null;
  const workWhileStudying = text.includes('travail') || text.includes('job') ? true : null;
  const needsFlexibleSchedule = text.includes('travail') || text.includes('job') ? true : null;
  const accessibilityNeeds = text.includes('handicap') ? true : null;

  return sanitizeProfileUpdates({
    fieldOfInterest,
    academicLevel,
    preferredRegion,
    preferredLanguage,
    institutionType,
    academicAverage,
    budgetMAD,
    academicConfidence,
    psychologicalReadiness,
    familySupport,
    mobility,
    riskTolerance,
    financialAidNeeded,
    workWhileStudying,
    needsFlexibleSchedule,
    accessibilityNeeds,
    constraints,
  });
}

export async function buildStudentProfile(messages = [], previous = {}) {
  const previousProfile = finalizeStudentProfile({
    ...createEmptyStudentProfile(),
    ...(previous || {}),
  });

  const safeMessages = Array.isArray(messages) ? messages.slice(-8) : [];
  const recentUserText = safeMessages
    .filter((m) => m?.role === 'user')
    .map((m) => normalizeText(m.content || ''))
    .join(' ')
    .slice(-2500);

  const llmUpdates = await extractStructuredInfo(safeMessages);
  const lexicalUpdates = fallbackLexicalExtraction(recentUserText);

  const merged = mergeStudentProfile(
    mergeStudentProfile(previousProfile, lexicalUpdates),
    llmUpdates,
  );

  return finalizeStudentProfile(merged);
}

export function getProfileSummary(profile = {}) {
  const readinessBand =
    profile.psychologicalReadiness != null && profile.academicConfidence != null
      ? profile.psychologicalReadiness >= 4 && profile.academicConfidence >= 4
        ? 'strong'
        : profile.psychologicalReadiness <= 2 || profile.academicConfidence <= 2
          ? 'fragile'
          : 'moderate'
      : 'unknown';

  return {
    studyField: profile.fieldOfInterest,
    level: profile.academicLevel,
    cityPreference: profile.preferredRegion,
    budgetMAD: profile.budgetMAD,
    readinessBand,
  };
}