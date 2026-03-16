export interface HiddenDependencyDetectorInput {
  text: string;
}

export interface HiddenDependencyDetectorOutput {
  dependencies: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function hiddenDependencyDetector(input: HiddenDependencyDetectorInput): HiddenDependencyDetectorOutput {
  const text = input.text.toLowerCase();
  const dependencies: string[] = [];

  if (/\b(se|if)\b/.test(text)) dependencies.push("Dependencia condicional explicita.");
  if (/\b(fonte|source|evid[eê]ncia|evidence)\b/.test(text)) dependencies.push("Dependencia de evidencia externa para sustentacao.");
  if (/\b(timeout|lat[eê]ncia|latency)\b/.test(text)) dependencies.push("Dependencia de janela temporal de execucao.");
  if (/\b(api|servi[cç]o|endpoint)\b/.test(text)) dependencies.push("Dependencia de servico externo.");

  return {
    dependencies,
    ok: true,
    component: "hidden-dependency-detector",
    score: Number(Math.min(1, dependencies.length / 5).toFixed(4)),
    detail: dependencies.join(" ") || "sem dependencia latente dominante",
    context: {
      textLength: input.text.length,
    },
  };
}
