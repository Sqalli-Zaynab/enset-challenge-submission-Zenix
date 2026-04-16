import crypto from "node:crypto";
import express from "express";
import { runZenixChatGraph } from "../agent/zenix-chat-graph.mjs";
import { validateBody } from "../middleware/validate.js";
import { chatTurnSchema } from "../validators/chat.schemas.js";

const router = express.Router();

async function handleChat(req, res) {
  const { message, threadId } = req.validatedBody;
  const tid = threadId || crypto.randomUUID();

  const result = await runZenixChatGraph({ message }, tid);

  return res.json({
    ...result,
    threadId: tid,
  });
}
router.post("/", validateBody(chatTurnSchema), handleChat);
router.post("/message", validateBody(chatTurnSchema), handleChat);

export default router;