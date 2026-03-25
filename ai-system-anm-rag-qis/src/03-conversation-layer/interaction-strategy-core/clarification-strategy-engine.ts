export interface ClarificationStrategyInput {
  ambiguity: number;
  text: string;
}

export interface ClarificationStrategy {
  needsClarification: boolean;
  strategy: "none" | "confirm_goal" | "ask_scope";
}

export function clarificationStrategyEngine(input: ClarificationStrategyInput): ClarificationStrategy {
  const text = `${input.text || ""}`.toLowerCase();
  const shortPrompt = text.split(/\s+/g).filter(Boolean).length <= 4;
  const vagueSignal = /\b(isso|aquilo|coisa|arruma|ajeita|faz ai|faca ai)\b/.test(text);
  const needs = input.ambiguity >= 0.55 || shortPrompt || vagueSignal;

  if (!needs) return { needsClarification: false, strategy: "none" };
  if (vagueSignal || shortPrompt) return { needsClarification: true, strategy: "confirm_goal" };
  return { needsClarification: true, strategy: "ask_scope" };
}
