/**
 * Responsabilidade do arquivo:
 * - Remover artefatos internos de raciocinio que nao devem aparecer ao usuario.
 * - Preservar apenas texto de resposta legivel antes da estruturacao final.
 * - Expor contagem/sinais removidos para trilha de auditabilidade da camada.
 */
export interface InternalArtifactFilterResult {
  text: string;
  removedCount: number;
  removedSignals: string[];
}

const ARTIFACT_LINE_RULES: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "line_thought_time", pattern: /^\s*pensou por \d+\s*(?:ms|s)\s*$/i },
  { signal: "line_evidence_guide", pattern: /\bevidencia[-\s]?guia\b/i },
  { signal: "line_multihypothesis", pattern: /\braciocinio multihipotese\b/i },
  { signal: "line_q_branch", pattern: /\bq-branch-\d+\b/i },
  { signal: "line_task_sequence", pattern: /\bsequencia de tarefas\b/i },
  { signal: "line_status_hypothesis", pattern: /\bstatus hypothesis\b/i },
  { signal: "line_contextual_reading", pattern: /\bleitura contextual[-\w]*\b/i },
  { signal: "line_abductive_support", pattern: /\bsuporte abdutivo\b/i },
];

const ARTIFACT_INLINE_RULES: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "inline_evidence_guide", pattern: /\bevidencia[-\s]?guia\s*:[^.\n]*(?:[.?!]|$)/gi },
  { signal: "inline_multihypothesis", pattern: /\braciocinio multihipotese\s*:[^.\n]*(?:[.?!]|$)/gi },
  { signal: "inline_q_branch", pattern: /\bq-branch-\d+\s*:[^.\n]*(?:[.?!]|$)/gi },
  { signal: "inline_task_sequence", pattern: /\bsequencia de tarefas\s*:[^.\n]*(?:[.?!]|$)/gi },
  { signal: "inline_contextual_reading", pattern: /\(\s*leitura contextual[-\w]*\s*\)/gi },
  { signal: "inline_hypothesis_status", pattern: /\(\s*status hypothesis\s*\)/gi },
];

function compactSpaces(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function filterInternalArtifacts(text: string): InternalArtifactFilterResult {
  const source = `${text || ""}`.replace(/\r/g, "").trim();
  if (!source) {
    return { text: "", removedCount: 0, removedSignals: [] };
  }

  const removedSignals: string[] = [];
  const keptLines: string[] = [];

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const lineRule = ARTIFACT_LINE_RULES.find((rule) => rule.pattern.test(line));
    if (lineRule) {
      removedSignals.push(lineRule.signal);
      continue;
    }

    let cleaned = line;
    for (const rule of ARTIFACT_INLINE_RULES) {
      const updated = cleaned.replace(rule.pattern, " ");
      if (updated !== cleaned) {
        removedSignals.push(rule.signal);
      }
      cleaned = updated;
    }

    cleaned = compactSpaces(cleaned);
    if (cleaned) keptLines.push(cleaned);
  }

  return {
    text: keptLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    removedCount: removedSignals.length,
    removedSignals: [...new Set(removedSignals)],
  };
}
