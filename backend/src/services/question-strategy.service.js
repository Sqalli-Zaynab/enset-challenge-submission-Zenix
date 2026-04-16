const SINGLE_QUESTION_FLOW = [
  {
    key: "fieldOfInterest",
    ask: "Quel domaine t’intéresse le plus ?",
    done: (p) => Boolean(p.fieldOfInterest),
  },
  {
    key: "academicLevel",
    ask: "Quel est ton niveau actuel ? (bac, licence, master)",
    done: (p) => Boolean(p.academicLevel),
  },
  {
    key: "academicStrength",
    ask: "Comment évalues-tu ton niveau scolaire ? (faible, moyen, bon, très bon)",
    done: (p) => p.academicConfidence != null || p.academicAverage != null,
  },
  {
    key: "preferredRegion",
    ask: "Quelle ville ou région préfères-tu pour étudier ?",
    done: (p) => Boolean(p.preferredRegion),
  },
  {
    key: "institutionType",
    ask: "Tu préfères un établissement public ou privé ?",
    done: (p) => Boolean(p.institutionType),
  },
  {
    key: "budgetMAD",
    ask: "Ton budget est plutôt faible, moyen ou élevé ?",
    done: (p) => p.budgetMAD != null || p.financialAidNeeded != null,
  },
  {
    key: "mobility",
    ask: "Peux-tu changer de ville pour étudier ?",
    done: (p) => p.mobility != null,
  },
  {
    key: "preferredLanguage",
    ask: "Tu préfères étudier en français, en anglais ou en arabe ?",
    done: (p) => Boolean(p.preferredLanguage),
  },
  {
    key: "riskTolerance",
    ask: "Tu veux une voie sûre, équilibrée ou ambitieuse ?",
    done: (p) => p.riskTolerance != null,
  },
  {
    key: "constraints",
    ask: "As-tu une contrainte importante à prendre en compte ?",
    done: (p) => Array.isArray(p.constraints) && p.constraints.length > 0,
  },
];

export function getFallbackQuestion(profile = {}) {
  const next = SINGLE_QUESTION_FLOW.find((item) => !item.done(profile));
  if (next) return next.ask;
  return "Merci, j’ai assez d’informations pour te proposer des parcours compatibles.";
}