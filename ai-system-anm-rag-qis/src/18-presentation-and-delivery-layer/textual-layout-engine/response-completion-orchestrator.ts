/**
 * @file response-completion-orchestrator.ts
 * @description Avalia se uma resposta textual pode encerrar ou precisa continuar sem fabricar conteúdo semântico.
 * @layer 18-presentation-and-delivery-layer
 * @purpose Detectar truncamento, seções abertas e obrigações pendentes antes da entrega final ao usuário.
 * @inputs Texto gerado e contexto de plano de layout, discurso longo e execução de obrigações.
 * @outputs Texto reparado localmente e estado de completude com score, bloqueios e pendências.
 * @dependsOn Tipos de layout e validação textual da camada de apresentação.
 * @usedBy Auditoria textual e etapa de montagem final da resposta.
 * @invariants Um texto parcial útil não deve receber score zero, mas também não deve ser marcado como encerrável quando há bloqueio duro.
 * @notes O reparo local só fecha pontuação/cauda aberta; ele não inventa a próxima seção nem completa obrigação sem base.
 */
import type {
  ResponseCompletionAssessment,
  ResponseCompletionContext,
  ResponseCompletionResult,
} from "./response-layout-types";

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function stripRoleTranscriptTail(value: string): string {
  const source = `${value || ""}`.trim();
  if (!source) return "";

  const roleTailPattern = /\b(?:usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*:\s*/i;
  const match = roleTailPattern.exec(source);
  if (!match || match.index <= 0) return source;

  const head = source.slice(0, match.index).trim();
  return head || source;
}

function splitParagraphs(text: string): string[] {
  return `${text || ""}`
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function dedupeParagraphs(text: string): string {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length <= 1) return `${text || ""}`.trim();

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const paragraph of paragraphs) {
    const key = normalize(paragraph);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(paragraph);
  }

  return unique.join("\n\n").trim();
}

function sanitizeCompletionText(text: string): string {
  const withoutLabels = stripDialogueLabels(`${text || ""}`);
  const withoutTail = stripRoleTranscriptTail(withoutLabels);
  const deduped = dedupeParagraphs(withoutTail);
  return collapseWhitespace(deduped);
}

function endsWithDanglingConnector(text: string): boolean {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return false;

  return /\b(e|ou|mas|porque|portanto|logo|assim|entao|then|and|or|because|therefore)\s*[:\-]?\s*$/i.test(
    trimmed,
  );
}

function hasCutWordEnding(text: string): boolean {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return false;

  if (/[.!?)]$/.test(trimmed)) return false;
  if (/[,:;–—-]$/.test(trimmed)) return true;

  const token = (trimmed.match(/([a-zA-Z\u00C0-\u017F]{2,24})$/) || [])[1] || "";
  if (!token) return false;

  const safeTokens = new Set([
    "sim",
    "nao",
    "não",
    "fim",
    "logo",
    "entao",
    "então",
    "assim",
    "portanto",
    "conclusao",
    "conclusão",
    "sintese",
    "síntese",
    "resumo",
    "fechamento",
    "resposta",
    "direta",
    "pronto",
    "certo",
  ]);

  if (safeTokens.has(token.toLowerCase())) return false;

  const shortText = trimmed.length < 120;
  if (shortText) return false;

  const sentenceCount = splitSentences(trimmed).length;
  if (sentenceCount >= 2 && token.length >= 5) return false;

  return token.length <= 4;
}

function countUnescapedQuoteLike(text: string, quote: string): number {
  const source = `${text || ""}`;
  let total = 0;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    if (current !== quote) continue;

    const previous = source[index - 1] || "";
    const next = source[index + 1] || "";

    if (quote === "'" && /[a-zA-Z\u00C0-\u017F]/.test(previous) && /[a-zA-Z\u00C0-\u017F]/.test(next)) {
      continue;
    }

    total += 1;
  }

  return total;
}

function hasUnclosedPairs(text: string): boolean {
  const source = `${text || ""}`;
  const openParen = (source.match(/\(/g) || []).length;
  const closeParen = (source.match(/\)/g) || []).length;
  const openBracket = (source.match(/\[/g) || []).length;
  const closeBracket = (source.match(/\]/g) || []).length;
  const doubleQuotes = countUnescapedQuoteLike(source, `"`);
  const singleQuotes = countUnescapedQuoteLike(source, `'`);

  if (openParen !== closeParen) return true;
  if (openBracket !== closeBracket) return true;
  if (doubleQuotes % 2 !== 0) return true;
  if (singleQuotes % 2 !== 0) return true;

  return false;
}

function hasOpenSection(text: string): boolean {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return true;

  if (endsWithDanglingConnector(trimmed)) return true;
  if (hasUnclosedPairs(trimmed)) return true;
  if (hasCutWordEnding(trimmed)) return true;

  return false;
}

function hasClosedConclusion(text: string, context?: ResponseCompletionContext): boolean {
  const paragraphs = splitParagraphs(text);
  if (!paragraphs.length) return false;

  const tailParagraph = `${paragraphs[paragraphs.length - 1] || ""}`.trim();
  const normalizedTail = normalize(tailParagraph);
  const hasTerminalPunctuation = /[.!?)]\s*$/.test(tailParagraph);

  if (!hasTerminalPunctuation) return false;

  const longFormActive = Boolean(context?.longFormDiscourse?.isActive);
  const complexity = `${context?.plan?.complexity || ""}`.trim().toLowerCase();

  if (!longFormActive && complexity !== "deep" && complexity !== "long") {
    return true;
  }

  const closureSignals = [
    "conclusao",
    "em sintese",
    "sintese",
    "fechamento",
    "portanto",
    "assim",
    "resumo final",
    "concluindo",
  ];

  if (closureSignals.some((signal) => normalizedTail.includes(signal))) return true;
  if (paragraphs.length >= 2) return true;

  return false;
}

function minimumParagraphTarget(context?: ResponseCompletionContext): number {
  const complexity = `${context?.plan?.complexity || ""}`.trim().toLowerCase();

  if (complexity === "deep") return 3;
  if (complexity === "long") return 2;
  if (complexity === "medium") return 2;
  return 1;
}

function resolvePendingCriticalObligations(context?: ResponseCompletionContext): string[] {
  const pendingByScore = (context?.taskExecutionState?.obligationSatisfactionScores || [])
    .filter((item) => !item.passed)
    .map((item) => `${item.label || item.type || item.obligationId}`.trim())
    .filter(Boolean);

  if (pendingByScore.length > 0) {
    return [...new Set(pendingByScore)].slice(0, 6);
  }

  const pendingByLongForm = (context?.longFormDiscourse?.pendingObligations || [])
    .map((item) => `${item || ""}`.trim())
    .filter(Boolean);

  return [...new Set(pendingByLongForm)].slice(0, 6);
}

function resolvePendingParagraphs(text: string, context?: ResponseCompletionContext): string[] {
  if (!context?.longFormDiscourse?.isActive) return [];

  const paragraphs = splitParagraphs(text);
  const target = minimumParagraphTarget(context);
  const missingCount = Math.max(0, target - paragraphs.length);

  if (missingCount === 0) return [];
  if (`${text || ""}`.trim().length >= 700) return [];

  const pending: string[] = [];
  for (let i = 0; i < missingCount; i += 1) {
    pending.push(`paragraph_${paragraphs.length + i + 1}`);
  }

  return pending;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildAssessment(text: string, context?: ResponseCompletionContext): ResponseCompletionAssessment {
  const sanitized = sanitizeCompletionText(text);
  const pendingCriticalObligations = resolvePendingCriticalObligations(context);
  const pendingParagraphs = resolvePendingParagraphs(sanitized, context);
  const openSection = hasOpenSection(sanitized);
  const closedConclusion = hasClosedConclusion(sanitized, context);
  const finalExecutionBlocked = Boolean(context?.taskExecutionState?.finalExecutionGate?.shouldBlock);

  const integrity =
    context?.taskExecutionState?.integrityChecks || {
      isTruncated: false,
      hasAbruptEnding: false,
      missingSections: [],
      issues: [],
    };

  const hardBlockReasons: string[] = [];
  const softBlockReasons: string[] = [];

  if (finalExecutionBlocked) {
    hardBlockReasons.push(
      ...(context?.taskExecutionState?.finalExecutionGate?.blockReasons || ["final_execution_gate_blocked"]),
    );
  }

  if (integrity.isTruncated) hardBlockReasons.push("response_truncated");
  if (integrity.hasAbruptEnding) hardBlockReasons.push("response_abrupt_ending");
  if (openSection) hardBlockReasons.push("open_section_detected");

  if ((integrity.missingSections || []).length > 0) {
    softBlockReasons.push("response_missing_sections");
  }
  if (pendingCriticalObligations.length > 0) {
    softBlockReasons.push("pending_critical_obligations");
  }
  if (pendingParagraphs.length > 0) {
    softBlockReasons.push("pending_paragraph_plan");
  }
  if (!closedConclusion && minimumParagraphTarget(context) >= 3) {
    softBlockReasons.push("missing_conclusion_closure");
  }

  const paragraphs = splitParagraphs(sanitized);
  const completedObligationsCount = context?.longFormDiscourse?.completedObligations.length || 0;

  let score = 0.55;
  score += Math.min(0.14, paragraphs.length * 0.05);
  score += `${sanitized || ""}`.trim().length >= 140 ? 0.1 : 0;
  score += `${sanitized || ""}`.trim().length >= 700 ? 0.06 : 0;
  score += closedConclusion ? 0.08 : 0;
  score += Math.min(0.18, completedObligationsCount * 0.06);

  score -= finalExecutionBlocked ? 0.28 : 0;
  score -= integrity.isTruncated ? 0.22 : 0;
  score -= integrity.hasAbruptEnding ? 0.14 : 0;
  score -= openSection ? 0.18 : 0;
  score -= Math.min(0.08, pendingCriticalObligations.length * 0.03);
  score -= Math.min(0.06, pendingParagraphs.length * 0.03);

  score = clamp01(score);

  if (score === 0 && sanitized.length >= 120 && (hardBlockReasons.length > 0 || softBlockReasons.length > 0)) {
    score = 0.24;
  }

  const shouldContinue =
    hardBlockReasons.length > 0 ||
    (!closedConclusion && `${sanitized || ""}`.trim().length < 120);

  return {
    shouldContinue,
    completionScore: Number(score.toFixed(4)),
    pendingCriticalObligations,
    pendingParagraphs,
    hasOpenSection: openSection,
    hasClosedConclusion: closedConclusion,
    canSafelyTerminate: hardBlockReasons.length === 0 && score >= 0.72,
    terminationBlockReasons: [...new Set([...hardBlockReasons, ...softBlockReasons])],
    continuationApplied: false,
    continuationIterations: 0,
  };
}

function ensureNarrativeClosure(text: string): string {
  let output = sanitizeCompletionText(text);
  if (!output) return output;

  output = output
    .replace(/\b(e|ou|mas|porque|portanto|logo|assim|entao)\s+(o|a|os|as|um|uma|de|do|da|dos|das)\s*$/i, "")
    .replace(/\b(e|ou|mas|porque|portanto|logo|assim|entao)\s+[a-z]{1,2}\s*$/i, "")
    .replace(/\b(e|ou|mas|porque|portanto|logo|assim|entao)\s*[:\-]?\s*$/i, "")
    .replace(/[,:;–—-]\s*$/g, "")
    .trim();

  if (output && !/[.!?)]$/.test(output)) {
    output = `${output}.`;
  }

  return output;
}

function applyLocalCompletionRepair(text: string, assessment: ResponseCompletionAssessment): string {
  let repaired = sanitizeCompletionText(text);
  if (!repaired) return repaired;

  if (assessment.hasOpenSection || !assessment.hasClosedConclusion) {
    repaired = ensureNarrativeClosure(repaired);
  }

  return sanitizeCompletionText(repaired);
}

function downgradeToSafeTermination(
  assessment: ResponseCompletionAssessment,
  repaired: string,
): ResponseCompletionAssessment {
  const shortButClosed = repaired.length >= 80 && /[.!?)]$/.test(repaired.trim());
  const onlySoftReasons =
    assessment.terminationBlockReasons.every((reason) =>
      [
        "pending_critical_obligations",
        "pending_paragraph_plan",
        "missing_conclusion_closure",
        "response_missing_sections",
      ].includes(reason),
    );

  if (!shortButClosed || !onlySoftReasons) return assessment;

  return {
    ...assessment,
    shouldContinue: false,
    canSafelyTerminate: assessment.completionScore >= 0.64,
  };
}

export function runResponseCompletionOrchestrator(
  text: string,
  context?: ResponseCompletionContext,
): ResponseCompletionResult {
  const source = sanitizeCompletionText(text);

  if (!source) {
    return {
      text: "",
      state: {
        shouldContinue: true,
        completionScore: 0,
        pendingCriticalObligations: [],
        pendingParagraphs: ["paragraph_1"],
        hasOpenSection: true,
        hasClosedConclusion: false,
        canSafelyTerminate: false,
        terminationBlockReasons: ["empty_output"],
        continuationApplied: false,
        continuationIterations: 0,
      },
    };
  }

  const initialAssessment = buildAssessment(source, context);

  if (!initialAssessment.shouldContinue) {
    return {
      text: ensureNarrativeClosure(source),
      state: initialAssessment,
    };
  }

  const repaired = applyLocalCompletionRepair(source, initialAssessment);
  let reassessed = buildAssessment(repaired, context);
  reassessed = downgradeToSafeTermination(reassessed, repaired);

  return {
    text: repaired,
    state: {
      ...reassessed,
      continuationApplied: repaired !== source,
      continuationIterations: repaired !== source ? 1 : 0,
    },
  };
}
