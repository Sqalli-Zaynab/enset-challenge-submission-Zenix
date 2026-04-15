// agent/state.js
// Defines the TypedState for LangGraph workflow

/**
 * @typedef {Object} AgentState
 * @property {string[]} messages - Conversation history
 * @property {Object|null} profile - User profile (skills, interests, education)
 * @property {Object|null} plan - Generated career/study plan
 * @property {string[]} ragContext - Retrieved documents from vector DB
 * @property {boolean} humanApprovalNeeded - Flag to pause for human input
 * @property {Object|null} pendingAction - Action awaiting human approval
 * @property {string|null} error - Last error message
 */

// For LangGraph, we export a simple object with keys and default values
export const initialState = {
  messages: [],
  profile: null,
  plan: null,
  ragContext: [],
  humanApprovalNeeded: false,
  pendingAction: null,
  error: null,
};

// Optional: TypeScript-style JSDoc for IDE autocomplete
/**
 * @type {import('@langchain/langgraph').StateDefinition<AgentState>}
 */
export const stateDefinition = {
  messages: { value: (a, b) => a.concat(b), default: () => [] },
  profile: { value: (a, b) => b ?? a, default: null },
  plan: { value: (a, b) => b ?? a, default: null },
  ragContext: { value: (a, b) => [...new Set([...a, ...b])], default: () => [] },
  humanApprovalNeeded: { value: (a, b) => b ?? a, default: false },
  pendingAction: { value: (a, b) => b ?? a, default: null },
  error: { value: (a, b) => b ?? a, default: null },
};