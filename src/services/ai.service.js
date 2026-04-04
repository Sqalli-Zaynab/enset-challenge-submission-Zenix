const { runAgentGraph } = require('../agent/graph');

// Helper to run specific stages of the Agentic flow
exports.runCareerRecommendation = async (profileData) => {
    // Tells the agent to focus on 'Decision 1': Best career direction [cite: 10]
    return await runAgentGraph('recommend', profileData);
};

exports.runPlanGeneration = async (pathData) => {
    // Tells the agent to focus on 'Decision 2': Next actions and opportunities [cite: 16]
    return await runAgentGraph('plan', pathData);
};