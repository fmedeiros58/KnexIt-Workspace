/**
 * @file internal-artifact-filter.ts
 * @description Remove artefatos internos de raciocinio e continuidade que nao devem chegar ao usuario.
 * @layer 15-response-structure-engine
 * @purpose Preservar apenas texto de resposta legivel antes da estruturacao e do handoff final.
 * @inputs Texto candidato de resposta.
 * @outputs Texto filtrado, contagem de remocoes e sinais removidos.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy structure-layer-bridge e presentation-front-bridge.
 * @invariants O filtro nao deve apagar conteudo semantico util da resposta final.
 * @notes Tambem cobre artefatos inline porque alguns vazamentos aparecem em monoblocos longos.
 */
export interface InternalArtifactFilterResult {
  text: string;
  removedCount: number;
  removedSignals: string[];
}

const ROLE_NAME_PATTERN = String.raw`(?:usu(?:a|\u00e1|\u00c3\u00a1|\uFFFD|\u00ef\u00bf\u00bd|\?)rio|usuario|user|assistente|assistant|let(?:i|\u00ed|\u00c3\u00ad|\uFFFD|\u00ef\u00bf\u00bd|\?)cia|leticia)`;
const PERSONA_CONCAT_PATTERN = String.raw`\blet(?:i|\u00ed|\u00c3\u00ad|\uFFFD|\u00ef\u00bf\u00bd|\?)cia(?=\s*:|[A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00c2\u00ca\u00d4\u00c3\u00d5]|Sim|Nao|N\u00e3o|Desculpe|Obrigado|Ola|Ol\u00e1)`;
const EXPLANATION_PATTERN = String.raw`\bexplica(?:c|\u00e7|\u00c3\u00a7)(?:a|\u00e3|\u00c3\u00a3)o`;
const USER_WORD_PATTERN = String.raw`usu(?:a|\u00e1|\u00c3\u00a1|\uFFFD|\u00ef\u00bf\u00bd|\?)rio`;

const ARTIFACT_LINE_RULES: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "line_thought_time", pattern: /^\s*pensou por \d+\s*(?:ms|s)\s*$/i },
  { signal: "line_evidence_guide", pattern: /\bevidencia[-\s]?guia\b/i },
  { signal: "line_multihypothesis", pattern: /\braciocinio multihipotese\b/i },
  { signal: "line_q_branch", pattern: /\bq-branch-\d+\b/i },
  { signal: "line_task_sequence", pattern: /\bsequencia de tarefas\b/i },
  { signal: "line_continuity_anchor", pattern: /^\s*(?:continuidade|continuity\\*_anchor|continuity\\*_mode)\s*:/i },
  { signal: "line_meta_explanation_detail", pattern: new RegExp(String.raw`^\s*(?:a pergunta do ${USER_WORD_PATTERN}|a minha resposta|nao houve necessidade|n\u00e3o houve necessidade)\b`, "i") },
  { signal: "line_status_hypothesis", pattern: /\bstatus hypothesis\b/i },
  { signal: "line_contextual_reading", pattern: /\bleitura contextual[-\w]*\b/i },
  { signal: "line_abductive_support", pattern: /\bsuporte abdutivo\b/i },
];

const ARTIFACT_INLINE_RULES: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "inline_role_transcript_tail", pattern: new RegExp(String.raw`\b${ROLE_NAME_PATTERN}\s*:[\s\S]*$`, "gi") },
  { signal: "inline_persona_concat_tail", pattern: new RegExp(String.raw`${PERSONA_CONCAT_PATTERN}[\s\S]*$`, "gi") },
  { signal: "inline_evidence_guide", pattern: /\bevidencia[-\s]?guia\s*:[^.\n]*(?:[.?!]|$)/gi },
  { signal: "inline_multihypothesis", pattern: /\braciocinio multihipotese\s*:[^.\n]*(?:[.?!]|$)/gi },
  { signal: "inline_q_branch", pattern: /\bq-branch-\d+\s*:[^.\n]*(?:[.?!]|$)/gi },
  { signal: "inline_task_sequence", pattern: /\bsequencia de tarefas\s*:[^.\n]*(?:[.?!]|$)/gi },
  { signal: "inline_meta_explanation_header", pattern: new RegExp(String.raw`${EXPLANATION_PATTERN}\s*:\s*$`, "gi") },
  { signal: "inline_meta_explanation_about_response", pattern: new RegExp(String.raw`${EXPLANATION_PATTERN}\s*:\s*(?:\\n|\n|a pergunta do ${USER_WORD_PATTERN}|a minha resposta|nao houve necessidade|n\u00e3o houve necessidade)[\s\S]*$`, "gi") },
  { signal: "inline_continuity_anchor", pattern: /\bcontinuidade\s*:[\s\S]*$/gi },
  { signal: "inline_continuity_anchor", pattern: /\bcontinuity\\*_anchor\s*:[\s\S]*$/gi },
  { signal: "inline_continuity_mode", pattern: /\bcontinuity\\*_mode\s*:[\s\S]*$/gi },
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
    if (!line) {
      if (keptLines.length > 0 && keptLines[keptLines.length - 1] !== "") {
        keptLines.push("");
      }
      continue;
    }

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
