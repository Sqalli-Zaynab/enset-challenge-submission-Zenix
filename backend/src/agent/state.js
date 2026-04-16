import { Annotation } from "@langchain/langgraph";

export const State = Annotation.Root({
  mode: Annotation({ reducer: (_, r) => r, default: () => "chat" }),
  payload: Annotation({ reducer: (_, r) => r, default: () => ({}) }),
  messages: Annotation({ reducer: (a, b) => a.concat(b || []), default: () => [] }),
  collectedInfo: Annotation({ reducer: (_, r) => r, default: () => ({}) }),
  currentPhase: Annotation({ reducer: (_, r) => r, default: () => "general" }),
  profileComplete: Annotation({ reducer: (_, r) => r, default: () => false }),
  searchResults: Annotation({ reducer: (_, r) => r, default: () => [] }),
  plan: Annotation({ reducer: (_, r) => r, default: () => null }),
  trace: Annotation({ reducer: (a, b) => a.concat(b || []), default: () => [] }),
});