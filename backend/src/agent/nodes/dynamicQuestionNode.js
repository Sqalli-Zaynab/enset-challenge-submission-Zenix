import { runInterviewTurn } from '../../services/interview-agent.service.js';

export async function dynamicQuestionNode(state) {
  const result = await runInterviewTurn({
    messages: state.messages || [],
    currentProfile: state.studentProfile || {},
  });

  return {
    studentProfile: result.updatedProfile,
    nextQuestion: result.nextQuestion,
    readyForSearch: result.interviewReady,
    readyForPlan: result.interviewReady,
    interviewAssessment: result.interviewAssessment,
    confidenceByDimension: result.confidenceByDimension,
    detectedSignals: result.detectedSignals,
    reasoningSummary: result.reasoningSummary,
    messages:
      !result.interviewReady && result.nextQuestion
        ? [{ role: 'assistant', content: result.nextQuestion }]
        : [],
    trace: [
      `DynamicQuestion: interviewReady=${result.interviewReady}`,
      `DynamicQuestion: stage=${result.interviewAssessment.interviewStage}`,
      `DynamicQuestion: coverage=${result.interviewAssessment.coverageScore}`,
    ],
  };
}