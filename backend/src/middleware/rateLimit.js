const rateLimit = require('express-rate-limit');

// General limiter for all routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per IP
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limiter for AI/plan endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 AI requests per hour
  message: { error: 'AI endpoint limit reached. Please wait.' }
});

module.exports = { generalLimiter, aiLimiter };