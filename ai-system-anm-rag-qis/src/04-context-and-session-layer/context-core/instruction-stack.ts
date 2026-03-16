export interface InstructionStackInput {
  normalizedMessage: string;
  activeConstraints: string[];
}

export interface InstructionStackOutput {
  instructions: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function instructionStack(input: InstructionStackInput): InstructionStackOutput {
  const text = input.normalizedMessage.toLowerCase();
  const instructions: string[] = [];

  if (/\b(resuma|sumarize|summarize|resumo)\b/.test(text)) instructions.push("prefer_concise_output");
  if (/\b(passo a passo|step by step|did[aá]tico|ensine)\b/.test(text)) instructions.push("prefer_stepwise_explanation");
  if (/\b(s[oó] codigo|only code|sem explica[cç][aã]o)\b/.test(text)) instructions.push("prefer_code_only");
  if (/\b(com fontes|cite|source|refer[êe]ncias)\b/.test(text)) instructions.push("require_citations");
  if (/\b(curto|breve|objetivo)\b/.test(text)) instructions.push("prefer_brief_tone");
  if (/\b(detalhado|profundo|deep dive)\b/.test(text)) instructions.push("prefer_deep_dive");

  const merged = [...new Set([...input.activeConstraints, ...instructions])];
  const derived = merged.filter((item) => instructions.includes(item));
  const score = Math.max(0.2, Math.min(1, 0.3 + (derived.length * 0.12)));

  return {
    instructions: derived.slice(0, 10),
    ok: true,
    component: "instruction-stack",
    score: Number(score.toFixed(4)),
    detail: `instructions=${derived.length}`,
    context: {
      instructions: derived,
    },
  };
}
