// backend/src/controllers/plan.controller.js
import aiService from "../services/ai.service.js";

export const generatePlan = async (req, res) => {
  try {
    const result = await aiService.generatePlan(req.body);
    res.json(result);
  } catch (error) {
    console.error("Plan generation error:", error);
    res.status(500).json({ error: error.message });
  }
};