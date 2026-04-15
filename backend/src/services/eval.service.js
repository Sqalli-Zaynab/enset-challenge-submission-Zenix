const logger = require('../utils/logger');

const evaluationLogs = [];

const abTestPrompts = async (userInput, promptA, promptB, llmService) => {
  const responseA = await llmService.generateResponse(promptA + "\n\nUser: " + userInput);
  const responseB = await llmService.generateResponse(promptB + "\n\nUser: " + userInput);
  
  const scoreA = responseA.length;
  const scoreB = responseB.length;
  
  const result = {
    timestamp: new Date().toISOString(),
    userInput,
    responseA: responseA.substring(0, 200),
    responseB: responseB.substring(0, 200),
    scoreA,
    scoreB,
    winner: scoreA >= scoreB ? 'A' : 'B'
  };
  
  evaluationLogs.push(result);
  logger.logAI('AB_TEST', result);
  
  return result;
};

const getEvaluationSummary = () => {
  return {
    totalTests: evaluationLogs.length,
    logs: evaluationLogs.slice(-5)
  };
};

const simulateFineTuning = async (taskDescription) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    task: taskDescription,
    baseModelAccuracy: Math.floor(Math.random() * 30) + 60,
    fineTunedAccuracy: Math.floor(Math.random() * 20) + 75,
    improvement: "+" + Math.floor(Math.random() * 15) + "%",
    timestamp: new Date().toISOString()
  };
};

module.exports = { abTestPrompts, getEvaluationSummary, simulateFineTuning };