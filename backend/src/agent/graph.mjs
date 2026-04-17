// graph.mjs
// LangGraph orchestration with support for:
// - "recommend" mode (existing career recommendations)
// - "analyze" mode (existing profile diagnosis)
// - "chat" mode (conversational Moroccan university advisor with Groq + Tavily)

// FIX: Import MemorySaver for native LangGraph multi-turn persistence.
// This replaces the manual sessions Map in chat.routes.js entirely.
import { StateGraph, Annotation, START, END, MemorySaver } from "@langchain/langgraph";
import { randomUUID } from "node:crypto";
import { recommendCareersFromProfile } from "../services/career-recommendation.service.js";

// Import all external nodes
import { profileNode } from "./nodes/profilesNode.js";
import { ragNode } from "./nodes/ragNode.js";
import { planNode } from "./nodes/planNode.js";
import { humanCheckpointNode } from "./nodes/humanCheckpointNode.js";

// Import chat and search nodes for Moroccan university advisor
import { chatNode } from "./nodes/chatNode.js";
import { searchNode } from "./nodes/searchNode.js";

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
  const recommendationResult = await recommendCareersFromProfile(state.profile);

  return {
    scoredCareers: recommendationResult.scoredCareers,
    recommendations: {
      profileSummary: recommendationResult.profileSummary,
      topChoices: recommendationResult.topChoices,
    },
    trace: recommendationResult.agentTrace,
  };
}

function selectRecommendationsNode(state) {
  return {
    recommendations: state.recommendations,
    trace: [
      `ScenarioAgent: returned ${state.recommendations?.topChoices?.length || 0} deterministic career recommendations`,
      "ExplainabilityAgent: attached structured reasons and RAG-backed career resources",
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
  const config = { configurable: { thread_id: threadId || `${mode}-${randomUUID()}` } };

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
