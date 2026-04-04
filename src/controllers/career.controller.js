const aiService = require('../services/ai.service');

exports.recommendCareers = async (req, res) => {
    try {
        // Input: The structured profile from Block 1
        const structuredProfile = req.body;
        const recommendations = await aiService.runCareerRecommendation(structuredProfile);
        return res.status(200).json(recommendations);
    } catch (error) {
        res.status(500).json({ error: "Career recommendation failed" });
    }
};