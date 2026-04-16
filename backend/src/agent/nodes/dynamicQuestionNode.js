import { runInterviewTurn } from '../../services/interview-agent.service.js';

const MAX_INTERVIEW_ANSWERS = 10;

function countUserAnswers(messages = []) {
  return messages.filter(
    (message) => message.role === 'user' && String(message.content || '').trim(),
  ).length;
}

function lastAssistantMessage(messages = []) {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && String(message.content || '').trim())
    ?.content || '';
}

export async function dynamicQuestionNode(state) {
  const messages = state.messages || [];
  const maxQuestions = Number.isFinite(Number(state.maxQuestions))
    ? Number(state.maxQuestions)
    : MAX_INTERVIEW_ANSWERS;
  const stateQuestionCount = Number(state.questionCount);
  const questionCount = Number.isFinite(stateQuestionCount)
    ? Math.max(stateQuestionCount, countUserAnswers(messages))
    : countUserAnswers(messages);

  if (questionCount === 0) {
    return {
      studentProfile: state.studentProfile || {},
      nextQuestion: state.nextQuestion || lastAssistantMessage(messages),
      readyForSearch: false,
      readyForPlan: false,
      interviewAssessment: {
        ready: false,
        softReady: false,
        maxQuestionsReached: false,
        coverageScore: 0,
        missingCore: [],
        interviewStage: 'discovery',
        finalizeReason: null,
      },
      confidenceByDimension: state.confidenceByDimension || {},
      detectedSignals: state.detectedSignals || [],
      reasoningSummary: 'Opening question shown.',
      questionCount,
      maxQuestions,
      finalizeReason: null,
      messages: [],
      trace: [`DynamicQuestion: opening question preserved (${questionCount}/${maxQuestions})`],
    };
  }

  const result = await runInterviewTurn({
    messages,
    currentProfile: state.studentProfile || {},
    questionCount,
    maxQuestions,
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
    questionCount,
    maxQuestions,
    finalizeReason: result.interviewAssessment?.finalizeReason || null,
    messages:
      !result.interviewReady && result.nextQuestion
        ? [{ role: 'assistant', content: result.nextQuestion }]
        : [],
    trace: [
      `DynamicQuestion: questionCount=${questionCount}/${maxQuestions}`,
      `DynamicQuestion: interviewReady=${result.interviewReady}`,
      `DynamicQuestion: stage=${result.interviewAssessment.interviewStage}`,
      `DynamicQuestion: coverage=${result.interviewAssessment.coverageScore}`,
    ],
  };
}
