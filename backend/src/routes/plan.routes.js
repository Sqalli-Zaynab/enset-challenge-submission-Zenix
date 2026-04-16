import express from "express";
import * as planController from "../controllers/plan.controller.js";
import { validateBody } from "../middleware/validate.js";
import { planDecisionSchema } from "../validators/chat.schemas.js";

const router = express.Router();

router.post("/generate", planController.generatePlan);
router.post("/decision", validateBody(planDecisionSchema), planController.submitPlanDecision);
router.post("/confirm", validateBody(planDecisionSchema), planController.submitPlanDecision);

export default router;
