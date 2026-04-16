// backend/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend root (same folder as this file)
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug logs to verify environment variables are loaded
console.log('🔑 GROQ_API_KEY loaded:', !!process.env.GROQ_API_KEY);
console.log('🔑 TAVILY_API_KEY loaded:', !!process.env.TAVILY_API_KEY);
console.log('📁 .env path:', path.join(__dirname, '.env'));

// Import routes
import profileRoutes from './src/routes/profile.routes.js';
import careerRoutes from './src/routes/career.routes.js';
import planRoutes from './src/routes/plan.routes.js';
import chatRoutes from './src/routes/chat.routes.js';
import evalRoutes from './src/routes/eval.routes.js';

// Import middleware
import { generalLimiter, aiLimiter } from './src/middleware/rateLimit.js';
import guardrailsMiddleware from './src/middleware/guardrails.js';
import logger from './utils/logger.js';

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());
app.use(guardrailsMiddleware);
app.use(generalLimiter);

// API routes
app.use('/api/profile', profileRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/plan', aiLimiter, planRoutes);
app.use('/api/chat', aiLimiter, chatRoutes);
app.use('/api/eval', evalRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(`✅ Guardrails active`);
  console.log(`✅ Rate limiting active`);
  console.log(`✅ Evaluation routes active`);
});