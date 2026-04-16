// chat.routes.js
import express from 'express';
import { runAgentGraph } from '../agent/graph.mjs';

const router = express.Router();

// FIX: The sessions Map has been removed entirely.
// LangGraph's MemorySaver checkpointer (configured in graph.mjs) now handles
// all per-thread state persistence — messages, collectedInfo, and currentPhase
// are automatically saved and restored on every invoke() call via thread_id.
// Keeping a manual Map alongside MemorySaver would cause the two stores to
// drift out of sync and produce the exact state-reset bugs we saw before.

const handleChat = async (req, res) => {
  const { message, threadId } = req.body;
  const tid = threadId || crypto.randomUUID();

  // FIX: Pass only the current user message in payload.
  // Do NOT pass messages/collectedInfo/currentPhase here — MemorySaver restores
  // the full prior state automatically when the same thread_id is supplied.
  // Passing them manually would conflict with checkpointed state and cause
  // duplication (concat reducer) or resets (replace reducer).
  const result = await runAgentGraph(
    'chat',
    { message },  // ← only the new message; everything else comes from the checkpoint
    null,
    tid,          // ← passed as threadId; graph.mjs wraps it as { configurable: { thread_id: tid } }
  );

  res.json({ ...result, threadId: tid });
};

router.post('/',        handleChat);
router.post('/message', handleChat);

export default router;