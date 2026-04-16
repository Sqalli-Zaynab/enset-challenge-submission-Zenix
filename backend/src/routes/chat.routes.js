import crypto from "node:crypto";
import express from "express";
import { runZenixChatGraph } from "../agent/zenix-chat-graph.mjs";
import { validateBody } from "../middleware/validate.js";
import { chatTurnSchema } from "../validators/chat.schemas.js";

const router = express.Router();

async function handleChat(req, res) {
  try {
    const { message, threadId } = req.validatedBody;
    const tid = threadId || crypto.randomUUID();

    const result = await runZenixChatGraph(
      { message: message || "" },
      tid,
    );

    return res.json({
      ...result,
      threadId: tid,
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error?.message || "Unknown chat processing error",
      stack:
        process.env.NODE_ENV === "development" ? error?.stack : undefined,
    });
  }
}

router.post("/", validateBody(chatTurnSchema), handleChat);
router.post("/message", validateBody(chatTurnSchema), handleChat);

export default router;