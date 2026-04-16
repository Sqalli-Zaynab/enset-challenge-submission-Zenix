// backend/src/controllers/career.controller.js
import aiService from "../services/ai.service.js";

export const recommendCareers = async (req, res) => {
  try {
    const result = await aiService.recommendCareers(req.body);
    res.json(result);
  } catch (error) {
    console.error("Career recommendation error:", error);
    res.status(500).json({ error: error.message });
  }
};