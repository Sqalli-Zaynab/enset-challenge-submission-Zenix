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
  // Check all possible user input fields
  const userInput = req.body.prompt || req.body.message || req.body.query || req.query.q;
  
  if (userInput && detectPromptInjection(userInput)) {
    console.log(`[SECURITY] Prompt injection blocked: ${userInput.substring(0, 100)}`);
    return res.status(400).json({ 
      error: 'Security violation: Potentially malicious prompt detected',
      blocked: true
    });
  }
  
  if (userInput && req.body.prompt) {
    req.body.prompt = sanitizeInput(userInput);
  }
  
  next();
};

module.exports = guardrailsMiddleware;