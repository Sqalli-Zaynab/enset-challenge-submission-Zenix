import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { studentProfilerNode } from "./nodes/studentProfilerNode.js";
import { dynamicQuestionNode } from "./nodes/dynamicQuestionNode.js";
import { searchSchoolsNode } from "./nodes/searchSchoolsNode.js";
import { verifySourcesNode } from "./nodes/verifySourcesNode.js";
import { buildStudyPlanNode } from "./nodes/buildStudyPlanNode.js";

const MAX_MESSAGES = 12;
const MAX_TRACE = 30;
const MAX_INTERVIEW_ANSWERS = 10;
const OPENING_QUESTION =
  "Tell me about yourself: what are you studying, what are you curious about, and what kind of future are you trying to build?";

const State = Annotation.Root({
  mode: Annotation({ reducer: (_l, r) => r, default: () => "chat" }),
  payload: Annotation({ reducer: (_l, r) => r, default: () => ({}) }),
  messages: Annotation({
    reducer: (l, r) => [...(l || []), ...(r || [])].slice(-MAX_MESSAGES),
    default: () => [],
  }),
  studentProfile: Annotation({ reducer: (_l, r) => r, default: () => ({}) }),
  studentSummary: Annotation({ reducer: (_l, r) => r, default: () => null }),
  nextQuestion: Annotation({ reducer: (_l, r) => r, default: () => "" }),
  readyForSearch: Annotation({ reducer: (_l, r) => r, default: () => false }),
  readyForPlan: Annotation({ reducer: (_l, r) => r, default: () => false }),
  questionCount: Annotation({ reducer: (_l, r) => r, default: () => 0 }),
  maxQuestions: Annotation({ reducer: (_l, r) => r, default: () => MAX_INTERVIEW_ANSWERS }),
  finalizeReason: Annotation({ reducer: (_l, r) => r, default: () => null }),
  interviewAssessment: Annotation({ reducer: (_l, r) => r, default: () => null }),
  confidenceByDimension: Annotation({ reducer: (_l, r) => r, default: () => ({}) }),
  detectedSignals: Annotation({ reducer: (_l, r) => r, default: () => [] }),
  reasoningSummary: Annotation({ reducer: (_l, r) => r, default: () => "" }),
  rawSources: Annotation({ reducer: (_l, r) => r, default: () => [] }),
  verifiedSources: Annotation({ reducer: (_l, r) => r, default: () => [] }),
  searchQueries: Annotation({ reducer: (_l, r) => r, default: () => [] }),
  plan: Annotation({ reducer: (_l, r) => r, default: () => null }),
  trace: Annotation({
    reducer: (l, r) => [...(l || []), ...(r || [])].slice(-MAX_TRACE),
    default: () => [],
  }),
});

function inputNode(state) {
  const message = state.payload?.message?.trim() || "";

  if (!message) {
    return {
      messages: [{ role: "assistant", content: OPENING_QUESTION }],
      nextQuestion: OPENING_QUESTION,
      trace: ["InputNode: welcome turn"],
      maxQuestions: MAX_INTERVIEW_ANSWERS,
    };
  }

  return {
    messages: [{ role: "user", content: message }],
    trace: ["InputNode: user message appended"],
    maxQuestions: MAX_INTERVIEW_ANSWERS,
    questionCount: Number(state.questionCount || 0) + 1,
  };
}

function routeAfterQuestion(state) {
  return state.readyForPlan ? "searchSchools" : END;
}

function lastAssistantMessage(messages = []) {
  return [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && String(message.content || "").trim())
    ?.content || "";
}

const graph = new StateGraph(State)
  .addNode("inputNode", inputNode)
  .addNode("studentProfiler", studentProfilerNode)
  .addNode("dynamicQuestion", dynamicQuestionNode)
  .addNode("searchSchools", searchSchoolsNode)
  .addNode("verifySources", verifySourcesNode)
  .addNode("buildStudyPlan", buildStudyPlanNode)
  .addEdge(START, "inputNode")
  .addEdge("inputNode", "studentProfiler")
  .addEdge("studentProfiler", "dynamicQuestion")
  .addConditionalEdges("dynamicQuestion", routeAfterQuestion, ["searchSchools", END])
  .addEdge("searchSchools", "verifySources")
  .addEdge("verifySources", "buildStudyPlan")
  .addEdge("buildStudyPlan", END)
  .compile({ checkpointer: new MemorySaver() });

export async function runZenixChatGraph(payload = {}, threadId = null) {
  const input = {
    mode: "chat",
    payload,
  };

  const config = threadId ? { configurable: { thread_id: threadId } } : {};
  const result = await graph.invoke(input, config);

  if (!result.readyForPlan || !result.plan) {
    return {
      status: "collecting",
      response: result.nextQuestion || lastAssistantMessage(result.messages),
      threadId,
      messages: result.messages,
      studentProfile: result.studentProfile,
      studentSummary: result.studentSummary,
      interviewAssessment: result.interviewAssessment,
      confidenceByDimension: result.confidenceByDimension,
      detectedSignals: result.detectedSignals,
      reasoningSummary: result.reasoningSummary,
      questionCount: result.questionCount,
      maxQuestions: result.maxQuestions,
      finalizeReason: result.finalizeReason,
      agentTrace: result.trace,
    };
  }

  return {
    status: "plan_ready",
    plan: result.plan,
    searchQueries: result.searchQueries,
    verifiedSources: result.verifiedSources,
    messages: result.messages,
    studentProfile: result.studentProfile,
    studentSummary: result.studentSummary,
    interviewAssessment: result.interviewAssessment,
    confidenceByDimension: result.confidenceByDimension,
    detectedSignals: result.detectedSignals,
    reasoningSummary: result.reasoningSummary,
    questionCount: result.questionCount,
    maxQuestions: result.maxQuestions,
    finalizeReason: result.finalizeReason,
    agentTrace: result.trace,
  };
}
