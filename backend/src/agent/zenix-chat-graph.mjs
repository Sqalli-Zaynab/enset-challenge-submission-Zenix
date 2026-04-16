import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { studentProfilerNode } from "./nodes/studentProfilerNode.js";
import { dynamicQuestionNode } from "./nodes/dynamicQuestionNode.js";
import { searchSchoolsNode } from "./nodes/searchSchoolsNode.js";
import { verifySourcesNode } from "./nodes/verifySourcesNode.js";
import { buildStudyPlanNode } from "./nodes/buildStudyPlanNode.js";

const State = Annotation.Root({
  mode: Annotation({ reducer: (_l, r) => r, default: () => "chat" }),
  payload: Annotation({ reducer: (_l, r) => r, default: () => ({}) }),
  messages: Annotation({ reducer: (l, r) => l.concat(r || []), default: () => [] }),
  studentProfile: Annotation({ reducer: (_l, r) => r, default: () => ({}) }),
  studentSummary: Annotation({ reducer: (_l, r) => r, default: () => null }),
  nextQuestion: Annotation({ reducer: (_l, r) => r, default: () => "" }),
  readyForSearch: Annotation({ reducer: (_l, r) => r, default: () => false }),
  readyForPlan: Annotation({ reducer: (_l, r) => r, default: () => false }),
  rawSources: Annotation({ reducer: (_l, r) => r, default: () => [] }),
  verifiedSources: Annotation({ reducer: (_l, r) => r, default: () => [] }),
  searchQueries: Annotation({ reducer: (_l, r) => r, default: () => [] }),
  plan: Annotation({ reducer: (_l, r) => r, default: () => null }),
  trace: Annotation({ reducer: (l, r) => l.concat(r || []), default: () => [] }),
});
function inputNode(state) {
  const message = state.payload?.message?.trim() || "";

  if (!message) {
    return {
      messages: [{ role: "assistant", content: "Salut 👋 Je vais t’aider à choisir une voie réaliste. D’abord, quel domaine t’intéresse le plus ?" }],
      trace: ["InputNode: welcome turn"],
    };
  }

  return {
    messages: [{ role: "user", content: message }],
    trace: ["InputNode: user message appended"],
  };
}
function routeAfterQuestion(state) {
  return state.readyForPlan ? "searchSchools" : END;
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
      response: result.nextQuestion,
      threadId,
      messages: result.messages,
      studentProfile: result.studentProfile,
      studentSummary: result.studentSummary,
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
    agentTrace: result.trace,
  };
}