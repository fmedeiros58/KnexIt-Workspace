export interface QuestionAskingInput {
  needsClarification: boolean;
  strategy: "none" | "confirm_goal" | "ask_scope";
}

export interface QuestionAskingResult {
  followUpPrompt: string | null;
}

export function questionAskingEngine(input: QuestionAskingInput): QuestionAskingResult {
  if (!input.needsClarification) return { followUpPrompt: null };
  if (input.strategy === "confirm_goal") {
    return { followUpPrompt: "Quer que eu foque no objetivo principal agora?" };
  }
  return { followUpPrompt: "Você quer um ajuste rápido ou uma análise mais profunda?" };
}
