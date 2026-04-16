// backend/src/agent/nodes/humanCheckpointNode.js
export async function humanCheckpointNode(state) {
  if (state.userApproval === "approved") {
    return { humanApprovalNeeded: false, pendingAction: null, userApproval: null };
  }
  if (state.userApproval === "rejected") {
    return { humanApprovalNeeded: false, pendingAction: null, userApproval: null, plan: null };
  }
  if (state.plan && !state.humanApprovalNeeded) {
    return {
      humanApprovalNeeded: true,
      pendingAction: { type: "APPROVE_PLAN", data: state.plan },
    };
  }
  return state;
}