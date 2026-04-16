// graph.mjs
// LangGraph orchestration with support for:
// - "recommend" mode (existing career recommendations)
// - "analyze" mode (existing profile diagnosis)
// - "chat" mode (conversational Moroccan university advisor with Groq + Tavily)

// FIX: Import MemorySaver for native LangGraph multi-turn persistence.
// This replaces the manual sessions Map in chat.routes.js entirely.
import { StateGraph, Annotation, START, END, MemorySaver } from "@langchain/langgraph";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Import all external nodes
import { profileNode } from "./nodes/profilesNode.js";
import { ragNode } from "./nodes/ragNode.js";
import { planNode } from "./nodes/planNode.js";
import { humanCheckpointNode } from "./nodes/humanCheckpointNode.js";

// Import chat and search nodes for Moroccan university advisor
import { chatNode } from "./nodes/chatNode.js";
import { searchNode } from "./nodes/searchNode.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ------------------------------------------------------------
// STATE DEFINITION (extended with conversation fields)
// ------------------------------------------------------------
const State = Annotation.Root({
  mode: Annotation({
    reducer: (_left, right) => right,
    default: () => "recommend",
  }),
  payload: Annotation({
    reducer: (_left, right) => right,
    default: () => ({}),
  }),
  profile: Annotation({
    reducer: (_left, right) => right,
    default: () => ({}),
  }),
  diagnosis: Annotation({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  scoredCareers: Annotation({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  recommendations: Annotation({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  plan: Annotation({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  trace: Annotation({
    reducer: (left, right) => left.concat(right || []),
    default: () => [],
  }),
  ragContext: Annotation({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  humanApprovalNeeded: Annotation({
    reducer: (_left, right) => right,
    default: () => false,
  }),
  pendingAction: Annotation({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  userApproval: Annotation({
    reducer: (_left, right) => right,
    default: () => null,
  }),

  // Conversation fields for chat mode.
  // IMPORTANT: messages uses a concat reducer, meaning chatNode must return
  // ONLY the new messages for this turn (the delta), not the full array.
  // Returning the full array will cause every prior message to be duplicated.
  messages: Annotation({
    reducer: (left, right) => left.concat(right || []),
    default: () => [],
  }),
  collectedInfo: Annotation({
    reducer: (_left, right) => right,
    default: () => ({}),
  }),
  currentPhase: Annotation({
    reducer: (_left, right) => right,
    default: () => "general",
  }),
  nextQuestion: Annotation({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  profileComplete: Annotation({
    reducer: (_left, right) => right,
    default: () => false,
  }),
  searchResults: Annotation({
    reducer: (_left, right) => right,
    default: () => [],
  }),
});

// ------------------------------------------------------------
// HELPER FUNCTIONS (shared by multiple nodes)
// ------------------------------------------------------------
const CAREERS_PATH       = path.join(__dirname, "..", "data", "careers.json");
const OPPORTUNITIES_PATH = path.join(__dirname, "..", "data", "oportunities.json");

const skillRank      = { beginner: 1, intermediate: 2, advanced: 3 };
const difficultyRank = { easy: 1, medium: 2, hard: 3 };

async function readJson(filePath) {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(item => String(item).split(",")).map(item => item.trim().toLowerCase()).filter(Boolean);
  }
  return String(value).split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function textIncludesAny(text, keywords) {
  const lowered = String(text || "").toLowerCase();
  return keywords.some(keyword => lowered.includes(String(keyword).toLowerCase()));
}

function overlap(listA, listB) {
  const setB = new Set(normalizeArray(listB));
  return normalizeArray(listA).filter(item => setB.has(item));
}

function formatCareer(career) {
  return {
    id: career.id,
    title: career.title,
    score: career.score,
    entryDifficulty: career.entryDifficulty,
    shortDescription: career.shortDescription,
    reasons: career.reasons.slice(0, 3),
    recommendedOpportunities: career.recommendedOpportunities,
  };
}

// ------------------------------------------------------------
// NODES THAT REMAIN INLINE (for recommend/analyze modes)
// ------------------------------------------------------------
function diagnoseProfileNode(state) {
  const profile = state.profile;

  let recommendationMode = "explore";
  if (profile.careerClarity === "some_ideas") recommendationMode = "compare";
  if (profile.careerClarity === "i_know")     recommendationMode = "execute";

  const challengeLabels = {
    i_dont_know_what_fits_me:         "fit discovery",
    i_dont_know_how_to_reach_my_goal: "execution gap",
    i_cant_find_opportunities:        "opportunity discovery",
  };

  const diagnosis = {
    recommendationMode,
    mainNeed: challengeLabels[profile.mainChallenge] || "direction clarification",
    summary: `You seem driven by ${profile.themes?.slice(0, 2).join(" and ") || "general exploration"}. The agent should use a ${recommendationMode} strategy.`,
    suggestedNextStep:
      recommendationMode === "explore"
        ? "Compare 3 different tracks and validate with small projects."
        : recommendationMode === "compare"
          ? "Rank your top options and test them with focused opportunities."
          : "Build a short action roadmap toward your chosen path.",
  };

  return {
    diagnosis,
    trace: [
      `DiagnosisAgent: mode -> ${recommendationMode}`,
      `DiagnosisAgent: main need -> ${diagnosis.mainNeed}`,
    ],
  };
}

async function scoreCareersNode(state) {
  const careers = await readJson(CAREERS_PATH);
  const profile = state.profile;

  const scoredCareers = careers.map(career => {
    const reasons = [];
    let score = 0;

    const interestHits = overlap([...profile.passions, ...profile.interests], career.tags);
    if (interestHits.length) {
      score += Math.min(interestHits.length * 8, 24);
      reasons.push(`matches your interests: ${interestHits.slice(0, 3).join(", ")}`);
    }

    const strengthHits = overlap(profile.strengths, career.strengthTags);
    if (strengthHits.length) {
      score += Math.min(strengthHits.length * 7, 21);
      reasons.push(`fits your strengths: ${strengthHits.slice(0, 3).join(", ")}`);
    }

    const causeHits = overlap(profile.causes, career.causeTags);
    if (causeHits.length) {
      score += Math.min(causeHits.length * 5, 10);
      reasons.push(`connects with causes you care about: ${causeHits.slice(0, 2).join(", ")}`);
    }

    if (career.fieldTags.some(tag => profile.fieldOfStudy.includes(tag))) {
      score += 10;
      reasons.push(`aligned with your current field: ${profile.fieldOfStudy}`);
    }

    const readinessGap = (skillRank[profile.skillLevel] || 1) - (difficultyRank[career.entryDifficulty] || 1);
    if (readinessGap >= 0) {
      score += 10;
      reasons.push(`your current skill level can support this path`);
    } else if (readinessGap === -1) {
      score += 4;
      reasons.push(`reachable with a short upskilling phase`);
    }

    if (textIncludesAny(profile.personalGoal, career.goalKeywords)) {
      score += 15;
      reasons.push(`matches your personal goal`);
    }

    if (profile.values.length && overlap(profile.values, career.valueTags).length) {
      score += 8;
      reasons.push(`fits your work values`);
    }

    if (profile.preferredLocation && career.locationOptions.includes(profile.preferredLocation)) {
      score += 4;
      reasons.push(`compatible with your preferred location`);
    }

    return { ...career, score, reasons };
  });

  scoredCareers.sort((a, b) => b.score - a.score);

  return {
    scoredCareers,
    trace: [`MatchingAgent: evaluated ${scoredCareers.length} career paths`],
  };
}

function selectRecommendationsNode(state) {
  const profile   = state.profile;
  const sorted    = state.scoredCareers || [];
  const readiness = profile.readiness || 1;

  const main        = sorted[0] || null;
  const alternative = sorted.find(item => item.id !== main?.id) || null;
  const safe = sorted.find(
    item =>
      item.id !== main?.id &&
      item.id !== alternative?.id &&
      (difficultyRank[item.entryDifficulty] || 2) <= readiness,
  ) || sorted[2] || null;

  const recommendations = {
    profileSummary: { themes: profile.themes, readiness, careerClarity: profile.careerClarity },
    topChoices: [
      main        ? { label: "best_fit",    ...formatCareer(main)        } : null,
      alternative ? { label: "alternative", ...formatCareer(alternative) } : null,
      safe        ? { label: "safe_option", ...formatCareer(safe)        } : null,
    ].filter(Boolean),
  };

  return {
    recommendations,
    trace: [
      `ScenarioAgent: selected ${recommendations.topChoices.length} scenarios`,
      `ExplainabilityAgent: generated reasons for each scenario`,
    ],
  };
}

// ------------------------------------------------------------
// CONDITIONAL ROUTING
// ------------------------------------------------------------

// Route at START — chat goes directly to chatNode, skipping buildProfile entirely.
// buildProfile was resetting collectedInfo/currentPhase on every call.
function routeByModeAtStart(state) {
  if (state.mode === "chat") return "chatNode";
  return "buildProfile";
}

// Only used after buildProfile (non-chat modes).
function routeFromMode(state) {
  if (state.mode === "analyze") return "diagnoseProfile";
  if (state.mode === "plan")    return "retrieveRAG";
  return "scoreCareers";
}

function routeAfterChat(state) {
  return state.profileComplete ? "searchNode" : END;
}

function afterHumanCheckpoint(_state) {
  return END;
}

// ------------------------------------------------------------
// BUILD GRAPH
// ------------------------------------------------------------

// FIX: Create a MemorySaver checkpointer. This replaces the manual sessions
// Map in chat.routes.js — LangGraph persists and restores the full state
// (messages, collectedInfo, currentPhase) automatically per thread_id.
const checkpointer = new MemorySaver();

const graph = new StateGraph(State)
  .addNode("buildProfile",          profileNode)
  .addNode("diagnoseProfile",       diagnoseProfileNode)
  .addNode("scoreCareers",          scoreCareersNode)
  .addNode("selectRecommendations", selectRecommendationsNode)
  .addNode("retrieveRAG",           ragNode)
  .addNode("buildPlan",             planNode)
  .addNode("humanCheckpoint",       humanCheckpointNode)
  .addNode("chatNode",              chatNode)
  .addNode("searchNode",            searchNode)

  .addConditionalEdges(START, routeByModeAtStart, ["buildProfile", "chatNode"])

  .addConditionalEdges("buildProfile", routeFromMode, [
    "diagnoseProfile",
    "retrieveRAG",
    "scoreCareers",
  ])

  // Chat pipeline
  .addConditionalEdges("chatNode", routeAfterChat, ["searchNode", END])
  .addEdge("searchNode",      "buildPlan")
  .addEdge("buildPlan",       "humanCheckpoint")
  .addConditionalEdges("humanCheckpoint", afterHumanCheckpoint, ["humanCheckpoint", END])

  // Non-chat pipelines
  .addEdge("retrieveRAG",           "buildPlan")
  .addEdge("diagnoseProfile",       END)
  .addEdge("scoreCareers",          "selectRecommendations")
  .addEdge("selectRecommendations", END)

  // FIX: Compile with the checkpointer so LangGraph links each invoke()
  // call to its prior state via the thread_id in config.
  .compile({ checkpointer });

// ------------------------------------------------------------
// EXPORTED RUN FUNCTION
// ------------------------------------------------------------
export async function runAgentGraph(mode = "recommend", payload = {}, userApproval = null, threadId = null) {
  // FIX: For chat mode, MemorySaver restores messages/collectedInfo/currentPhase
  // automatically — do NOT pass them manually in input or they will conflict with
  // the checkpointed state and cause duplication / resets.
  const input = {
    mode,
    payload,
    userApproval: userApproval ?? null,
  };

  // FIX: Pass threadId correctly as { configurable: { thread_id } }.
  // Previously the raw string was passed as the config argument, which LangGraph
  // silently ignores, meaning the checkpointer never linked calls to a thread.
  const config = threadId ? { configurable: { thread_id: threadId } } : {};

  const result = await graph.invoke(input, config);

  if (mode === "analyze") {
    return {
      profile:    result.profile,
      diagnosis:  result.diagnosis,
      agentTrace: result.trace,
    };
  }

  if (mode === "plan") {
    if (result.humanApprovalNeeded) {
      return {
        status:        "awaiting_approval",
        pendingAction: result.pendingAction,
        agentTrace:    result.trace,
      };
    }
    return {
      profile:    result.profile,
      ...result.plan,
      agentTrace: result.trace,
    };
  }

  if (mode === "chat") {
    if (result.humanApprovalNeeded) {
      return {
        status:        "awaiting_approval",
        pendingAction: result.pendingAction,
        agentTrace:    result.trace,
      };
    }
    if (!result.profileComplete) {
      return {
        status:        "collecting",
        response:      result.nextQuestion,
        messages:      result.messages,
        collectedInfo: result.collectedInfo,
        currentPhase:  result.currentPhase,
        profileComplete: false,
        agentTrace:    result.trace,
      };
    }
    return {
      status:        "plan_ready",
      plan:          result.plan,
      messages:      result.messages,
      collectedInfo: result.collectedInfo,
      currentPhase:  result.currentPhase,
      profileComplete: true,
      agentTrace:    result.trace,
    };
  }

  return {
    profile: result.profile,
    ...result.recommendations,
    agentTrace: result.trace,
  };
}
