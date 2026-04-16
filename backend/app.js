import express from "express";
import cors from "cors";

import profileRoutes from "./src/routes/profile.routes.js";
import careerRoutes from "./src/routes/career.routes.js";
import planRoutes from "./src/routes/plan.routes.js";
import chatRoutes from "./src/routes/chat.routes.js";
import evalRoutes from "./src/routes/eval.routes.js";

import { generalLimiter, aiLimiter } from "./src/middleware/rateLimit.js";
import guardrailsMiddleware from "./src/middleware/guardrails.js";
import logger from "./utils/logger.js";
import { env, hasGroq, hasTavily } from "./src/config/env.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(guardrailsMiddleware);
app.use(generalLimiter);
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      groq: hasGroq,
      tavily: hasTavily,
    },
  });
});

app.use("/api/profile", profileRoutes);
app.use("/api/career", careerRoutes);
app.use("/api/plan", aiLimiter, planRoutes);
app.use("/api/chat", aiLimiter, chatRoutes);
app.use("/api/eval", evalRoutes);
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);

  if (err.message === "Prompt injection detected") {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error: "Internal server error",
    message: env.NODE_ENV === "development" ? err.message : undefined,
  });
});
app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
  console.log(`Guardrails active`);
  console.log(`Rate limiting active`);
  console.log(`Groq configured: ${hasGroq}`);
  console.log(`Tavily configured: ${hasTavily}`);
});