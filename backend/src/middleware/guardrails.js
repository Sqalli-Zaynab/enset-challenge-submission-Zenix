// backend/src/middleware/guardrails.js

// Input sanitization and prompt injection detection
function detectPromptInjection(input) {
  const patterns = [
    /ignore previous instructions/i,
    /forget your rules/i,
    /you are now DAN/i,
    /system prompt:/i,
    /you are an AI/i,
    /pretend you are/i,
    /disregard all previous/i,
    /override your guidelines/i,
  ];
  return patterns.some(pattern => pattern.test(input));
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Remove any potentially harmful characters (basic)
  return input.replace(/[<>]/g, '').trim();
}

const guardrailsMiddleware = (req, res, next) => {
  // Check for prompt injection in request body (strings)
  const checkValue = (value) => {
    if (typeof value === 'string') {
      if (detectPromptInjection(value)) {
        throw new Error('Prompt injection detected');
      }
    }
  };

  try {
    if (req.body) {
      Object.values(req.body).forEach(checkValue);
    }
    if (req.query) {
      Object.values(req.query).forEach(checkValue);
    }
    // Sanitize body strings (optional)
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
    next();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export default guardrailsMiddleware;