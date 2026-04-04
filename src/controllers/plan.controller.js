const aiService = require('../services/ai.service');

exports.generatePlan = async (req, res) => {
    try {
        // Input: The selected career path and user profile
        const selectionData = req.body;
        const actionPlan = await aiService.runPlanGeneration(selectionData);
        return res.status(200).json(actionPlan);
    } catch (error) {
        res.status(500).json({ error: "Action plan generation failed" });
    }
};