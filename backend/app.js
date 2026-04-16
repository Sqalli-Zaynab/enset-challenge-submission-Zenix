import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

import profileRoutes from './src/routes/profile.routes.js';
import careerRoutes from './src/routes/career.routes.js';
import planRoutes from './src/routes/plan.routes.js';
import chatRoutes from './src/routes/chat.routes.js';
import { generalLimiter, aiLimiter } from './src/middleware/rateLimit.js';
import guardrailsMiddleware from './src/middleware/guardrails.js';
import logger from './utils/logger.js';
import evalRoutes from './src/routes/eval.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(guardrailsMiddleware);
app.use(generalLimiter);

app.use('/api/profile', profileRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/plan', aiLimiter, planRoutes);
app.use('/api/chat', aiLimiter, chatRoutes);
app.use('/api/eval', evalRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`✅ Guardrails active`);
  console.log(`✅ Rate limiting active`);
  console.log(`✅ Evaluation routes active`);
});