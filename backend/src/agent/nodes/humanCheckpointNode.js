// agent/nodes/humanCheckpointNode.js
// LangGraph node for Human-in-the-Loop checkpoint

export async function humanCheckpointNode(state) {
  // If user already approved, skip pause
  if (state.userApproval === "approved") {
    return { 
      humanApprovalNeeded: false, 
      pendingAction: null, 
      userApproval: null 
    };
  }
  
  if (state.userApproval === "rejected") {
    return { 
      humanApprovalNeeded: false, 
      pendingAction: null, 
      userApproval: null, 
      plan: null 
    };
  }

  // First time: pause and wait for approval
  const pendingPlan = state.plan;
  if (pendingPlan && !state.humanApprovalNeeded) {
    return {
      humanApprovalNeeded: true,
      pendingAction: {
        type: "APPROVE_PLAN",
        data: {
          selectedPath: pendingPlan.selectedPath,
          roadmap: pendingPlan.roadmap,
          recommendedOpportunitiesCount: pendingPlan.recommendedOpportunities?.length,
        },
      },
    };
  }
  
  return state;
}