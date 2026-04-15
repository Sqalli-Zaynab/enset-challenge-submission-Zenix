const express = require('express');
const cors = require('cors');
require('dotenv').config();

const profileRoutes = require('./src/routes/profile.routes');
const careerRoutes = require('./src/routes/career.routes');
const planRoutes = require('./src/routes/plan.routes');

// ===== NEW IMPORTS =====
const { generalLimiter, aiLimiter } = require('./src/middleware/rateLimit');
const guardrailsMiddleware = require('./src/middleware/guardrails');
const logger = require('./src/utils/logger');

const app = express();

// ===== EXISTING MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// ===== NEW MIDDLEWARE (order matters!) =====
app.use(guardrailsMiddleware);  // 1. Check for prompt injection FIRST
app.use(generalLimiter);        // 2. Rate limit all requests

// ===== ROUTES =====
app.use('/api/profile', profileRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/plan', aiLimiter, planRoutes);  // 3. Stricter limit for AI route

// ===== HEALTH CHECK (optional but good) =====
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== ERROR HANDLER (optional) =====
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`✅ Guardrails active`);
  console.log(`✅ Rate limiting active`);
});