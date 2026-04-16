import express from 'express';
import { runAgentGraph } from '../../../agent/graph.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { message, threadId } = req.body;
  const result = await runAgentGraph('chat', { message }, null, threadId || crypto.randomUUID());
  
  res.json({
    ...result,
    threadId: threadId || result.threadId,
  });
});

export default router;