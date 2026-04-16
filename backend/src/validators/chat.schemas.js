import { z } from "zod";

export const chatTurnSchema = z.object({
  message: z.string().trim().max(2500).optional().default(""),
  threadId: z.string().trim().min(1).max(200).optional(),
});

export const planDecisionSchema = z.object({
  threadId: z.string().trim().min(1).max(200),
  decision: z.enum(["approved", "rejected"]),
  feedback: z.string().trim().max(1500).optional().default(""),
  plan: z.any().optional().default(null),
});