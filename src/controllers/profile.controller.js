const aiService = require('../services/ai.service');

exports.analyzeProfile = async (req, res) => {
    try {
        // INNOVATION TRICK: We take everything the user typed (Deep Questions, etc.)
        const rawUserData = req.body; 

        // Pass it to the Agent's Brain
        const agentResponse = await aiService.runAgentFlow(rawUserData);

        // Send the AI's "Thought Process" back to the UI
        return res.status(200).json(agentResponse);
    } catch (error) {
        console.error("Agent Connection Error:", error);
        res.status(500).json({ error: "The AI Agent is currently overthinking. Try again!" });
    }
};