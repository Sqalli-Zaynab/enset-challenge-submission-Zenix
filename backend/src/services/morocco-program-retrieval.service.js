const SOURCE_WEIGHTS = {
  "direct-program": 12,
  "faculty-program-list": 8,
  "school-homepage": 3,
  "fallback-local": 1,
};

const TARGET_RESULT_COUNT = 4;

function normalizeText(value) {
  return String(value || "")
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

function tokenize(...values) {
  return values
    .flatMap((value) => normalizeArray(value))
    .flatMap((value) => value.split(/[^a-z0-9+]+/g))
    .filter((token) => token.length > 1);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function overlaps(left = [], right = []) {
  const rightSet = new Set(right);
  return unique(left).filter((item) => rightSet.has(item));
}

function toTitleCase(value) {
  return String(value || "")
    .split(/[\s-]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildProgramQuery(career, profile) {
  const queryTerms = unique([
    normalizeText(career?.id),
    normalizeText(career?.title),
    ...normalizeArray(career?.tags),
    ...normalizeArray(career?.fieldTags),
    ...normalizeArray(profile?.fieldOfStudy),
    ...normalizeArray(profile?.interests),
    ...normalizeArray(profile?.passions),
    ...normalizeArray(profile?.strengths),
  ]);

  return {
    text: queryTerms.filter(Boolean).slice(0, 12).join(" "),
    terms: queryTerms,
    tokens: tokenize(queryTerms),
  };
}

function getAcademicFitBoost(program, profile) {
  const degree = normalizeText(program.degreeLevel);
  const academicLevel = normalizeText(profile?.academicLevel);

  if (academicLevel === "high_school" && /(bac\+2|bac\+3|dut|bachelor)/.test(degree)) {
    return 3;
  }

  if (academicLevel === "undergraduate" && /(ingenieur|bac\+3|bac\+5)/.test(degree)) {
    return 2;
  }

  if (academicLevel === "graduate" && /(master|ingenieur|bac\+5)/.test(degree)) {
    return 2;
  }

  return 0;
}

function scoreProgram(program, career, profile, query) {
  const careerTargets = normalizeArray(program.careerTargets);
  const programTerms = unique([
    ...careerTargets,
    ...normalizeArray(program.tags),
    ...tokenize(
      program.program,
      program.school,
      program.degreeLevel,
      program.city,
      program.whyRelevant,
    ),
  ]);

  let score = 0;

  if (careerTargets.includes(normalizeText(career?.id))) {
    score += 30;
  }

  if (careerTargets[0] === normalizeText(career?.id)) {
    score += 10;
  }

  score += overlaps(programTerms, query.terms).length * 5;
  score += overlaps(programTerms, query.tokens).length * 2;
  score += SOURCE_WEIGHTS[program.sourceType] ?? 0;
  score += getAcademicFitBoost(program, profile);

  if (program.programUrl && program.sourceType === "direct-program") {
    score += 5;
  } else if (program.programUrl) {
    score += 2;
  }

  return score;
}

function normalizeProgram(program, score) {
  const programUrl = program.programUrl || "";
  const schoolUrl = program.schoolUrl || "";
  const link = programUrl || schoolUrl;

  return {
    id: program.id || slugify(`${program.school}-${program.program}`),
    school: program.school || "Moroccan higher education program",
    program: program.program || "Relevant program",
    degreeLevel: program.degreeLevel || "",
    city: toTitleCase(program.city || "Morocco"),
    careerTargets: normalizeArray(program.careerTargets),
    programUrl,
    schoolUrl,
    link,
    sourceType: program.sourceType || "fallback-local",
    sourceName: program.sourceName || "Local curated source",
    whyRelevant:
      program.whyRelevant ||
      "Relevant because it develops foundations aligned with the selected career.",
    retrievalScore: Number(score.toFixed(2)),
  };
}

function fallbackFromSchool(school, career, profile) {
  const program = school.program || career?.title || "Relevant program";
  const score =
    overlaps(normalizeArray(school.fieldTags), [
      ...normalizeArray(career?.tags),
      ...normalizeArray(career?.fieldTags),
      normalizeText(profile?.fieldOfStudy),
    ]).length * 4;

  return normalizeProgram(
    {
      id: `fallback-${slugify(school.name)}-${slugify(program)}`,
      school: school.name,
      program,
      degreeLevel: "Program",
      city: school.city,
      careerTargets: [career?.id],
      programUrl: "",
      schoolUrl: school.officialUrl,
      sourceType: "fallback-local",
      sourceName: "Local verified fallback dataset",
      whyRelevant:
        school.description ||
        `Fallback option with a study offer related to ${career?.title || "this path"}.`,
    },
    score + SOURCE_WEIGHTS["fallback-local"],
  );
}

function dedupeStudyOptions(options) {
  const seen = new Set();

  return options.filter((option) => {
    const key = `${normalizeText(option.school)}:${normalizeText(option.program)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function selectStudyPrograms({
  programs = [],
  fallbackSchools = [],
  career,
  profile,
  limit = TARGET_RESULT_COUNT,
}) {
  const query = buildProgramQuery(career, profile);

  const primaryMatches = programs
    .map((program) => ({
      program,
      score: scoreProgram(program, career, profile, query),
    }))
    .filter((item) => item.score >= 12)
    .sort((a, b) => b.score - a.score)
    .map((item) => normalizeProgram(item.program, item.score));

  const fallbackMatches = fallbackSchools
    .map((school) => fallbackFromSchool(school, career, profile))
    .filter((option) => option.retrievalScore > 1)
    .sort((a, b) => b.retrievalScore - a.retrievalScore);

  const studyOptions = dedupeStudyOptions([
    ...primaryMatches,
    ...fallbackMatches,
  ]).slice(0, limit);

  return {
    studyOptions,
    retrievalTrace: [
      `ProgramRAG: query -> ${query.text || career?.title || "general orientation"}`,
      `ProgramRAG: primary program index matches -> ${primaryMatches.length}`,
      `ProgramRAG: fallback school matches -> ${fallbackMatches.length}`,
      `ProgramRAG: returned ${studyOptions.length} normalized study options`,
    ],
  };
}
