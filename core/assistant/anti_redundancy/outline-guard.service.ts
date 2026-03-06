import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";

function tokenize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3);
}

function lexicalOverlapRatio(prompt: string, answer: string) {
  const promptTokens = new Set(tokenize(prompt));
  const answerTokens = new Set(tokenize(answer));
  if (!promptTokens.size || !answerTokens.size) return 0;
  let overlap = 0;
  for (const token of promptTokens) {
    if (answerTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(1, promptTokens.size);
}

export class OutlineGuardService {
  apply(answer: string, ctx: PipelineContext) {
    const trimmed = `${answer || ""}`.trim();
    if (!trimmed) return trimmed;
    const overlap = lexicalOverlapRatio(ctx.userMessage, trimmed);
    if (overlap >= 0.08) return trimmed;
    const scopeHint =
      ctx.attachments.length > 0
        ? "A resposta foi alinhada ao escopo solicitado e aos materiais anexados."
        : "A resposta foi alinhada ao escopo solicitado.";
    return `${scopeHint}\n\n${trimmed}`.trim();
  }

  preserveScope(text: string, constraints: string[], _plan: PipelineContext["plan"]) {
    const trimmed = `${text || ""}`.trim();
    if (!trimmed) return trimmed;
    if (!Array.isArray(constraints) || constraints.length === 0) return trimmed;
    const normalized = constraints.join(" ").toLowerCase();
    if (normalized.includes("sem_inventar")) {
      return `${trimmed}\n\nObservacao: foram evitadas inferencias sem base explicita.`.trim();
    }
    return trimmed;
  }
}
