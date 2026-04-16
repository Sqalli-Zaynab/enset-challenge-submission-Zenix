import express from "express";
import * as planController from "../controllers/plan.controller.js";

const router = express.Router();

router.post("/generate", planController.generatePlan);

export default router;