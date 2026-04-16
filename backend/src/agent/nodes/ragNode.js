// agent/nodes/ragNode.js
// LangGraph node for Agentic RAG (using real backend service)

import ragService from "../../services/rag.service.js";

export async function ragNode(state) {
  const profile = state.profile;
  
  // Build a query from the user's profile
  const query = `Career guidance for someone with interests in ${profile.interests.join(", ")} and strengths in ${profile.strengths.join(", ")}. Personal goal: ${profile.personalGoal}`;
  
  // Call the real RAG service (Pinecone/Chroma)
  const ragContext = await ragService.query(query, 3);
  
  return {
    ragContext,
    trace: [`RAGAgent: retrieved ${ragContext.length} relevant documents from knowledge base`],
  };
}