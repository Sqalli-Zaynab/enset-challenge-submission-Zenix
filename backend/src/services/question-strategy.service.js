const QUESTION_BY_DIMENSION = {
  fieldOfInterest:
    "Quel domaine t’attire réellement aujourd’hui, même si tu hésites encore ? (médecine, ingénierie/info, commerce, droit, arts...)",
  academicLevel:
    "Quel est ton niveau actuel ? (bac, licence, master)",
  academicConfidence:
    "Comment évalues-tu ton niveau scolaire aujourd’hui ? Donne-moi si possible une moyenne approximative ou ton ressenti.",
  preferredRegion:
    "Dans quelle ville ou région du Maroc préfères-tu étudier, ou es-tu prêt à bouger ?",
  preferredLanguage:
    "Tu préfères étudier en français, en anglais ou en arabe ?",
  institutionType:
    "Tu préfères un établissement public, privé, ou peu importe ?",
  budgetMAD:
    "Quel budget annuel peux-tu envisager environ ? Donne-moi un ordre de grandeur en MAD.",
  psychologicalReadiness:
    "Psychologiquement, tu te sens prêt pour un parcours exigeant, ou tu préfères une voie plus progressive et rassurante ?",
  familySupport:
    "Est-ce que ton entourage soutient vraiment ton projet, ou bien tu risques de devoir avancer avec peu de soutien ?",
  mobility:
    "Peux-tu déménager pour tes études ou dois-tu rester proche de ta ville actuelle ?",
  riskTolerance:
   "Tu préfères viser un parcours très sélectif avec plus de risque, ou une option plus sûre et stable ?",
  workWhileStudying:
    "Penses-tu devoir travailler pendant tes études ?",
};
export function getFallbackQuestion(profile = {}, readiness = null) {
  const critical = readiness?.missingCritical || [];
  if (critical.length) {
    const first = critical[0];
    return QUESTION_BY_DIMENSION[first] || "Peux-tu me donner plus de détails pour mieux comprendre ton profil ?";
  }

  const psychological = readiness?.missingPsychological || [];
  if (psychological.length) {
    const first = psychological[0];
    return QUESTION_BY_DIMENSION[first] || "J’ai besoin de mieux comprendre ta situation personnelle pour affiner la recommandation.";
  }

  const logistics = readiness?.missingLogistics || [];
  if (logistics.length) {
    const first = logistics[0];
    return QUESTION_BY_DIMENSION[first] || "J’ai besoin de comprendre tes contraintes pratiques pour aller plus loin.";
  }
  if (!Array.isArray(profile.interests) || profile.interests.length === 0) {
    return "Qu’est-ce qui te plaît vraiment dans ce domaine ? Les matières, le style de vie, le salaire, l’impact, la créativité, ou autre chose ?";
  }

  return "Merci. J’ai assez d’informations pour construire une recommandation réaliste et personnalisée.";
}