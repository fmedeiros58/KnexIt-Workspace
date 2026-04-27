/**
 * @file task-constraint-extractor.ts
 * @description Extrai restricoes explicitas do enunciado para o TaskContract.
 * @layer 05b-deliberative-task-contract-layer
 * @purpose Preservar regras do usuario antes da resposta final e alimentar validadores por classe.
 * @inputs Texto normalizado e restricoes ativas do ProcessingState.
 * @outputs Lista deduplicada de restricoes textuais.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy task-contract-builder e validadores de restricao.
 * @invariants Restricoes extraidas nao devem ser interpretadas como ja satisfeitas.
 * @notes Usa heuristica conservadora; validacao posterior decide impacto.
 */
export function extractTaskConstraints(text: string, activeConstraints: string[] = []): string[] {
  const normalized = `${text || ""}`.replace(/\s+/g, " ").trim();
  const constraints = new Set<string>();

  const sentenceMatches = normalized.split(/(?<=[.!?])\s+|\n+/g).map((item) => item.trim()).filter(Boolean);
  for (const sentence of sentenceMatches) {
    if (/\b(apenas|somente|s[oó]|n[aã]o|sem |deve|obrigat[oó]rio|restri[cç][aã]o|must|cannot|proibido)\b/i.test(sentence)) {
      constraints.add(sentence);
    }
  }

  for (const constraint of activeConstraints) {
    if (constraint && !/^adaptive_profile:|^adaptive_budget_class:/i.test(constraint)) {
      constraints.add(constraint);
    }
  }

  return [...constraints].slice(0, 16);
}

