// backend/src/agent/nodes/ragNode.js
import { ragService } from "../../services/rag.service.js";

export async function ragNode(state) {
  const profile = state.profile;
  const query = `Career guidance for interests: ${profile.interests?.join(", ")} strengths: ${profile.strengths?.join(", ")}`;
  
  const ragContext = await ragService.query(query, 3);
  
  return {
    ragContext,
    trace: [`RAGAgent: retrieved ${ragContext.length} documents`],
  };
}