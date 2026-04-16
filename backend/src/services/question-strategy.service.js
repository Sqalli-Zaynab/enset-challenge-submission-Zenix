const SINGLE_QUESTION_FLOW = [
  {
    key: "fieldOfInterest",
    ask: "Tell me in your own words what subjects, problems, or activities attract you most right now.",
    done: (p) => Boolean(p.fieldOfInterest),
  },
  {
    key: "academicLevel",
    ask: "Tell me where you are in your studies right now, using your own words.",
    done: (p) => Boolean(p.academicLevel),
  },
  {
    key: "academicStrength",
    ask: "How do you feel about your current academic level? You can mention grades, subjects, or just your confidence.",
    done: (p) => p.academicConfidence != null || p.academicAverage != null,
  },
  {
    key: "preferredRegion",
    ask: "Where would studying feel realistic for you? Mention any city, region, remote option, or mobility constraint.",
    done: (p) => Boolean(p.preferredRegion),
  },
  {
    key: "institutionType",
    ask: "What kind of school environment would work for you? Describe what matters, such as cost, selectivity, support, or flexibility.",
    done: (p) => Boolean(p.institutionType),
  },
  {
    key: "budgetMAD",
    ask: "What financial limits should I keep in mind? You can give a number, a range, or describe the situation generally.",
    done: (p) => p.budgetMAD != null || p.financialAidNeeded != null,
  },
  {
    key: "mobility",
    ask: "How flexible are you about moving or commuting for studies? Describe what is possible for you.",
    done: (p) => p.mobility != null,
  },
  {
    key: "preferredLanguage",
    ask: "What language environment feels most comfortable for learning, and why?",
    done: (p) => Boolean(p.preferredLanguage),
  },
  {
    key: "riskTolerance",
    ask: "How do you usually choose between a safer option and a more selective or uncertain one?",
    done: (p) => p.riskTolerance != null,
  },
  {
    key: "constraints",
    ask: "Is there any important constraint I should consider before recommending a path?",
    done: (p) => Array.isArray(p.constraints) && p.constraints.length > 0,
  },
];

function normalizeQuestion(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAskedQuestionSet(messages = []) {
  return new Set(
    messages
      .filter((message) => message.role === "assistant")
      .map((message) => normalizeQuestion(message.content))
      .filter(Boolean),
  );
}

export function getFallbackQuestion(profile = {}, _readiness = null, messages = []) {
  const asked = getAskedQuestionSet(messages);

  const next = SINGLE_QUESTION_FLOW.find(
    (item) => !item.done(profile) && !asked.has(normalizeQuestion(item.ask)),
  );
  if (next) return next.ask;

  const unasked = SINGLE_QUESTION_FLOW.find(
    (item) => !asked.has(normalizeQuestion(item.ask)),
  );
  if (unasked) return unasked.ask;

  return "I have enough information to propose compatible paths.";
}
