// backend/src/controllers/profile.controller.js
import aiService from "../services/ai.service.js";

export const analyzeProfile = async (req, res) => {
  try {
    const result = await aiService.analyzeProfile(req.body);
    res.json(result);
  } catch (error) {
    console.error("Profile analysis error:", error);
    res.status(500).json({ error: error.message });
  }
};