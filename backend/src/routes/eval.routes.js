import express from 'express';
import { getEvaluationSummary, simulateFineTuning } from '../services/eval.service.js';
import { generateResponse } from '../services/llm.service.js';

const router = express.Router();

router.get('/summary', (req, res) => {
  res.json(getEvaluationSummary());
});

router.post('/abtest', async (req, res) => {
  const promptA = "You are a helpful career advisor. Give detailed advice.";
  const promptB = "You are an expert educational planner. Provide structured guidance.";
  
  const responseA = await generateResponse(promptA + "\n\nUser: " + req.body.question);
  const responseB = await generateResponse(promptB + "\n\nUser: " + req.body.question);
  
  res.json({
    promptA: responseA,
    promptB: responseB,
    winner: responseA.length > responseB.length ? 'A' : 'B'
  });
});

router.post('/finetune', async (req, res) => {
  const result = await simulateFineTuning(req.body.task || "Education domain");
  res.json(result);
});

export default router;