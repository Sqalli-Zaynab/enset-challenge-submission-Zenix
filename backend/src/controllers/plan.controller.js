import { reviewPlanDecision } from "../services/plan-review.service.js";

export const submitPlanDecision = async (req, res) => {
  try {
    const result = reviewPlanDecision(req.validatedBody);
    res.json(result);
  } catch (error) {
    console.error("Plan decision error:", error);
    res.status(500).json({ error: error.message });
  }
};