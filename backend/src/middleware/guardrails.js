// Prompt injection detection (required by "Sécurité des Agents")
const DANGEROUS_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt/i,
  /you are now/i,
  /forget your rules/i,
  /roleplay as/i,
  /jailbreak/i,
  /ignore all rules/i,
  /act as if/i,
  /bypass/i,
  /you are an ai/i,
  /pretend you are/i
];

const sanitizeInput = (text) => {
  if (typeof text !== 'string') return '';
  // Remove dangerous characters that could break out of context
  return text.replace(/[<>{}[\]\\;`$]/g, '');
};

const detectPromptInjection = (text) => {
  if (!text) return false;
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(text));
};

const guardrailsMiddleware = (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // Check all possible user input fields
  const userInput = body.prompt || body.message || body.query || req.query?.q;
  
  if (userInput && detectPromptInjection(userInput)) {
    console.log(`[SECURITY] Prompt injection blocked: ${userInput.substring(0, 100)}`);
    return res.status(400).json({ 
      error: 'Security violation: Potentially malicious prompt detected',
      blocked: true
    });
  }
  
  if (userInput) {
    if (typeof body.prompt === 'string') {
      req.body.prompt = sanitizeInput(body.prompt);
    }

    if (typeof body.message === 'string') {
      req.body.message = sanitizeInput(body.message);
    }

    if (typeof body.query === 'string') {
      req.body.query = sanitizeInput(body.query);
    }
  }
  
  next();
};

module.exports = guardrailsMiddleware;