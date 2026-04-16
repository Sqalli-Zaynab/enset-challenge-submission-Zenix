import express from "express";
import * as profileController from "../controllers/profile.controller.js";

const router = express.Router();

router.post("/analyze", profileController.analyzeProfile);

export default router;