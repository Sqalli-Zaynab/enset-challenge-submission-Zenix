const logger = require('../../utils/logger');

async function generateResponse(prompt, systemPrompt = null) {
  logger.logAI('LLM_REQUEST', { prompt: prompt.substring(0, 200) });
  
  // Mock response for now
  await new Promise(resolve => setTimeout(resolve, 500));
  
  let response = "Based on your profile, I recommend focusing on software development. Start with JavaScript, then learn React and Node.js.";
  
  logger.logAI('LLM_RESPONSE', { response: response.substring(0, 200) });
  
  return response;
}

async function generateStream(prompt, onChunk) {
  const response = await generateResponse(prompt);
  const words = response.split(' ');
  for (const word of words) {
    onChunk(word + ' ');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return response;
}

module.exports = { generateResponse, generateStream };