// backend/src/middleware/rateLimit.js
import rateLimit from 'express-rate-limit';

// General limiter for all routes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for AI endpoints (Groq/Tavily)
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per minute
  message: 'Too many AI requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});