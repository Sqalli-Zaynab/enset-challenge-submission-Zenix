const QUESTIONS = {
  fieldOfInterest:
    "Quel domaine t’intéresse le plus aujourd’hui ? (médecine, ingénierie/info, commerce, droit, arts)",
  academicLevel: "Quel est ton niveau actuel ? (bac, licence, master)",
  preferredRegion: "Dans quelle ville ou région du Maroc préfères-tu étudier ?",
  preferredLanguage:
    "Tu préfères étudier en français, en anglais ou en arabe ?",
  institutionType:
    "Tu préfères un établissement public, privé, ou peu importe ?",
  budgetMAD: "Quel budget annuel peux-tu envisager environ ? (ex: 30000 MAD)",
};

export function getNextQuestion(profile) {
  for (const key of profile.missing || []) {
    if (QUESTIONS[key]) return QUESTIONS[key];
  }

  if ((profile.psychologicalReadiness ?? 3) <= 2) {
    return "Tu te sens plutôt confiant pour un parcours exigeant, ou tu préfères une voie plus progressive et rassurante ?";
  }

  if ((profile.familySupport ?? 3) <= 2) {
    return "Est-ce que ton entourage soutient ton projet, ou bien tu dois surtout compter sur toi-même ?";
  }

  if ((profile.mobility ?? 3) <= 2) {
    return "Est-ce que tu peux déménager pour tes études, ou tu dois rester près de ta ville actuelle ?";
  }

  if (!Array.isArray(profile.constraints) || profile.constraints.length === 0) {
    return "As-tu des contraintes particulières à prendre en compte ? (budget, transport, job étudiant, bourse, accessibilité)";
  }

  return "Merci. J’ai assez d’informations pour préparer une recommandation réaliste et personnalisée.";
}

export function isReadyForSearch(profile) {
  return Boolean(
    profile.fieldOfInterest &&
      profile.academicLevel &&
      profile.preferredRegion,
  );
}

export function isReadyForPlan(profile) {
  return Boolean(
    profile.fieldOfInterest &&
      profile.academicLevel &&
      profile.preferredRegion &&
      profile.preferredLanguage &&
      profile.institutionType &&
      profile.budgetMAD,
  );
}