import { getNextQuestion, isReadyForSearch, isReadyForPlan } from "../../services/question-strategy.service.js";

export async function dynamicQuestionNode(state) {
  const profile = state.studentProfile || {};
  const nextQuestion = getNextQuestion(profile);

  return {
    nextQuestion,
    readyForSearch: isReadyForSearch(profile),
    readyForPlan: isReadyForPlan(profile),
    trace: [
      `DynamicQuestion: readyForSearch=${isReadyForSearch(profile)}`,
      `DynamicQuestion: readyForPlan=${isReadyForPlan(profile)}`,
    ],
  };
}