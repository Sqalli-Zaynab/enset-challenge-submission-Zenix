import express from "express";
import * as careerController from "../controllers/career.controller.js";

const router = express.Router();

router.post("/recommend", careerController.recommendCareers);

export default router;