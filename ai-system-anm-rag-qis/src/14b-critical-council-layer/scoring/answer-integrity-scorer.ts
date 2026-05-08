import type {
  CouncilAdvisorReport,
  CouncilInput,
  CouncilRiskLevel,
  CouncilScoreResult,
} from "../council-types";

interface IntegrityCheck {
  readonly reason: string;
  readonly penalty: number;
  readonly severity: CouncilRiskLevel;
}

interface IntegrityContext {
  readonly userInput: string;
  readonly draftAnswer: string;
  readonly normalizedUser: string;
  readonly normalizedDraft: string;
  readonly advisorReports: CouncilAdvisorReport[];
  readonly advisorConcerns: string[];
  readonly advisorRequiredRevisions: string[];
  readonly advisorContradictions: string[];
  readonly advisorUnsupportedClaims: string[];
  readonly advisorMissingCounterpoints: string[];
  readonly advisorOverAgreementSignals: string[];
}

const CONCLUSION_MARKERS = [
  "conclusao",
  "conclusão",
  "concluindo",
  "em resumo",
  "portanto",
  "logo",
  "assim",
  "desse modo",
  "resultado final",
  "a resposta final",
  "o ponto central",
  "therefore",
  "thus",
  "in conclusion",
  "in summary",
  "final answer",
  "final recommendation",
];

const DIRECT_ANSWER_MARKERS = [
  "sim",
  "nao",
  "não",
  "depende",
  "correto",
  "incorreto",
  "parcialmente",
  "o problema",
  "o ponto",
  "a resposta",
  "yes",
  "no",
  "it depends",
  "correct",
  "incorrect",
];

const COMPLEX_TASK_MARKERS = [
  "analise",
  "análise",
  "avalie",
  "verifique",
  "explique",
  "resolva",
  "compare",
  "justifique",
  "demonstre",
  "desenvolva",
  "organize",
  "crie um plano",
  "passo a passo",
  "detalhado",
  "detalhada",
  "detalhista",
  "completo",
  "integral",
  "melhore",
  "corrija",
  "implemente",
  "arquitetura",
  "pipeline",
  "codex",
  "evaluate",
  "verify",
  "explain",
  "solve",
  "compare",
  "justify",
  "implement",
  "architecture",
];

const FORMAT_REQUEST_PATTERNS: ReadonlyArray<{
  readonly id: string;
  readonly requested: RegExp;
  readonly satisfied: (draft: string, normalizedDraft: string) => boolean;
  readonly penalty: number;
}> = [
  {
    id: "requested_code_missing",
    requested:
      /\b(codigo|código|code|typescript|javascript|python|funcao|função|function|classe|class|interface|arquivo|substitua o conteudo|substitua o conteúdo)\b/i,
    satisfied: (draft) =>
      /```[\s\S]+```/.test(draft) ||
      /\b(import|export|function|const|let|class|interface|type)\b/.test(draft),
    penalty: 0.22,
  },
  {
    id: "requested_list_missing",
    requested:
      /\b(lista|topicos|tópicos|bullet|bullets|itens|items|enumere|em pontos)\b/i,
    satisfied: (draft) => /(^|\n)\s*(?:[-*•]|\d+[.)])\s+\S+/m.test(draft),
    penalty: 0.12,
  },
  {
    id: "requested_table_missing",
    requested: /\b(tabela|quadro|table|colunas|columns)\b/i,
    satisfied: (draft) =>
      /\|.+\|/.test(draft) || /<table[\s>]/i.test(draft) || /\t/.test(draft),
    penalty: 0.16,
  },
  {
    id: "requested_json_missing",
    requested: /\bjson\b/i,
    satisfied: (draft) =>
      /```json[\s\S]+```/i.test(draft) ||
      /^\s*[{[][\s\S]*[}\]]\s*$/.test(draft),
    penalty: 0.2,
  },
  {
    id: "requested_prompt_missing",
    requested: /\b(prompt|codex)\b/i,
    satisfied: (_draft, normalizedDraft) =>
      normalizedDraft.includes("voce deve") ||
      normalizedDraft.includes("você deve") ||
      normalizedDraft.includes("you must") ||
      normalizedDraft.includes("objetivo") ||
      normalizedDraft.includes("instrucoes") ||
      normalizedDraft.includes("instruções"),
    penalty: 0.16,
  },
];

export function scoreAnswerIntegrity(input: {
  councilInput: CouncilInput;
  advisorReports: CouncilAdvisorReport[];
}): CouncilScoreResult {
  const context = buildIntegrityContext(input);

  const checks = dedupeChecks([
    ...checkDraftPresence(context),
    ...checkClosureAndDirectness(context),
    ...checkRepetition(context),
    ...checkAdvisorSignals(context),
    ...checkRequestedFormats(context),
    ...checkLanguageAndCoherence(context),
    ...checkStructuralProportion(context),
  ]);

  const penalty = clamp(
    checks.reduce((total, check) => total + check.penalty, 0),
    0,
    1,
  );

  const score = round(clamp(1 - penalty, 0, 1), 3);
  const level = integrityScoreToRiskLevel(score, checks);

  return {
    score,
    level,
    reasons: checks.map((check) => check.reason),
  };
}

function buildIntegrityContext(input: {
  councilInput: CouncilInput;
  advisorReports: CouncilAdvisorReport[];
}): IntegrityContext {
  const userInput = input.councilInput.userInput ?? "";
  const draftAnswer = input.councilInput.draftAnswer ?? "";
  const advisorReports = input.advisorReports ?? [];

  return {
    userInput,
    draftAnswer,
    normalizedUser: normalizeText(userInput),
    normalizedDraft: normalizeText(draftAnswer),
    advisorReports,
    advisorConcerns: dedupe(
      advisorReports.flatMap((report) => report.concerns ?? []),
    ),
    advisorRequiredRevisions: dedupe(
      advisorReports.flatMap((report) => report.requiredRevisions ?? []),
    ),
    advisorContradictions: dedupe(
      advisorReports.flatMap((report) => report.contradictions ?? []),
    ),
    advisorUnsupportedClaims: dedupe(
      advisorReports.flatMap((report) => report.unsupportedClaims ?? []),
    ),
    advisorMissingCounterpoints: dedupe(
      advisorReports.flatMap((report) => report.missingCounterpoints ?? []),
    ),
    advisorOverAgreementSignals: dedupe(
      advisorReports.flatMap((report) => report.overAgreementSignals ?? []),
    ),
  };
}

function checkDraftPresence(context: IntegrityContext): IntegrityCheck[] {
  const draftLength = context.normalizedDraft.length;
  const draftWordCount = wordCount(context.draftAnswer);

  if (draftLength === 0) {
    return [
      {
        reason: "empty_answer",
        penalty: 0.85,
        severity: "critical",
      },
    ];
  }

  if (draftLength < 40 || draftWordCount < 8) {
    return [
      {
        reason: "answer_too_short",
        penalty: 0.22,
        severity: "medium",
      },
    ];
  }

  return [];
}

function checkClosureAndDirectness(context: IntegrityContext): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (
    shouldRequireExplicitClosure(context) &&
    !containsAny(context.normalizedDraft, CONCLUSION_MARKERS)
  ) {
    checks.push({
      reason: "missing_explicit_closure",
      penalty: 0.18,
      severity: "medium",
    });
  }

  if (
    looksLikeQuestion(context.userInput) &&
    !hasDirectAnswerEarly(context.normalizedDraft)
  ) {
    checks.push({
      reason: "missing_direct_answer_near_start",
      penalty: 0.12,
      severity: "medium",
    });
  }

  if (
    context.normalizedDraft.includes("por eliminacao") ||
    context.normalizedDraft.includes("por eliminação") ||
    context.normalizedDraft.includes("by elimination")
  ) {
    const caseSignals =
      countMarkerHits(context.normalizedDraft, [
        "se",
        "caso",
        "cenario",
        "cenário",
        "alternativa",
        "opcao",
        "opção",
        "if",
        "case",
        "scenario",
        "alternative",
        "option",
      ]) + (context.normalizedDraft.match(/\b\d+[.)]\s+/g)?.length ?? 0);

    if (caseSignals < 2) {
      checks.push({
        reason: "elimination_claim_without_case_coverage",
        penalty: 0.16,
        severity: "medium",
      });
    }
  }

  return checks;
}

function checkRepetition(context: IntegrityContext): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (hasRepeatedBlocks(context.draftAnswer)) {
    checks.push({
      reason: "repetition_detected",
      penalty: 0.2,
      severity: "medium",
    });
  }

  if (hasRepeatedSentences(context.draftAnswer)) {
    checks.push({
      reason: "sentence_repetition_detected",
      penalty: 0.14,
      severity: "medium",
    });
  }

  if (hasNearDuplicateBlocks(context.draftAnswer)) {
    checks.push({
      reason: "near_duplicate_blocks_detected",
      penalty: 0.16,
      severity: "medium",
    });
  }

  return checks;
}

function checkAdvisorSignals(context: IntegrityContext): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];
  const allConcerns = normalizeJoined(context.advisorConcerns);
  const allRequiredRevisions = normalizeJoined(context.advisorRequiredRevisions);

  if (
    context.advisorContradictions.length > 0 ||
    includesAny(allConcerns, ["contradiction", "contradicao", "contradição", "always_vs_never"])
  ) {
    checks.push({
      reason: "contradiction_signal",
      penalty: 0.32,
      severity: "critical",
    });
  }

  if (
    includesAny(allConcerns, [
      "violated_constraints",
      "violated constraint",
      "constraint_violation",
      "restricao violada",
      "restrição violada",
    ])
  ) {
    checks.push({
      reason: "constraint_violation_signal",
      penalty: 0.28,
      severity: "critical",
    });
  }

  if (
    context.advisorUnsupportedClaims.length > 0 ||
    includesAny(allConcerns, ["unsupported", "sem suporte", "source_marker_without_source"])
  ) {
    checks.push({
      reason: "unsupported_claim_signal",
      penalty: 0.2,
      severity: "high",
    });
  }

  if (
    context.advisorMissingCounterpoints.length > 0 ||
    includesAny(allConcerns, ["missing_counterpoint", "counterpoint", "counterexample"])
  ) {
    checks.push({
      reason: "missing_counterpoint_signal",
      penalty: 0.14,
      severity: "medium",
    });
  }

  if (
    context.advisorOverAgreementSignals.length > 0 ||
    includesAny(allConcerns, ["sycophancy", "over_agreement", "over-agreement", "unconditional_agreement"])
  ) {
    checks.push({
      reason: "over_agreement_signal",
      penalty: 0.18,
      severity: "high",
    });
  }

  if (context.advisorRequiredRevisions.length > 0) {
    checks.push({
      reason: "required_revisions_pending",
      penalty: Math.min(0.22, 0.08 + context.advisorRequiredRevisions.length * 0.03),
      severity: "medium",
    });
  }

  if (
    includesAny(allRequiredRevisions, [
      "block delivery",
      "do not deliver",
      "nao entregar",
      "não entregar",
      "critical",
      "critico",
      "crítico",
    ])
  ) {
    checks.push({
      reason: "blocking_revision_signal",
      penalty: 0.3,
      severity: "critical",
    });
  }

  return checks;
}

function checkRequestedFormats(context: IntegrityContext): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  for (const format of FORMAT_REQUEST_PATTERNS) {
    if (!format.requested.test(context.userInput)) {
      continue;
    }

    if (format.satisfied(context.draftAnswer, context.normalizedDraft)) {
      continue;
    }

    checks.push({
      reason: format.id,
      penalty: format.penalty,
      severity: format.penalty >= 0.2 ? "high" : "medium",
    });
  }

  return checks;
}

function checkLanguageAndCoherence(context: IntegrityContext): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  const userLanguage = detectLanguage(context.userInput);
  const draftLanguage = detectLanguage(context.draftAnswer);

  if (
    userLanguage.language !== "unknown" &&
    draftLanguage.language !== "unknown" &&
    userLanguage.language !== draftLanguage.language &&
    userLanguage.confidence >= 0.45 &&
    draftLanguage.confidence >= 0.45
  ) {
    checks.push({
      reason: "language_shift_signal",
      penalty: 0.18,
      severity: "high",
    });
  }

  if (hasMixedLanguageWithoutReason(context.draftAnswer)) {
    checks.push({
      reason: "mixed_language_signal",
      penalty: 0.12,
      severity: "medium",
    });
  }

  if (hasUnbalancedCodeFence(context.draftAnswer)) {
    checks.push({
      reason: "unbalanced_code_fence",
      penalty: 0.16,
      severity: "medium",
    });
  }

  return checks;
}

function checkStructuralProportion(context: IntegrityContext): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];
  const draftWords = wordCount(context.draftAnswer);
  const userWords = wordCount(context.userInput);

  if (
    isComplexTask(context.normalizedUser) &&
    draftWords < 90 &&
    !FORMAT_REQUEST_PATTERNS[0].requested.test(context.userInput)
  ) {
    checks.push({
      reason: "answer_too_brief_for_complex_task",
      penalty: 0.16,
      severity: "medium",
    });
  }

  if (userWords <= 14 && draftWords > 420) {
    checks.push({
      reason: "answer_disproportionately_verbose",
      penalty: 0.1,
      severity: "medium",
    });
  }

  if (draftWords > 160 && hasLowParagraphStructure(context.draftAnswer)) {
    checks.push({
      reason: "weak_paragraph_structure",
      penalty: 0.1,
      severity: "medium",
    });
  }

  return checks;
}

function shouldRequireExplicitClosure(context: IntegrityContext): boolean {
  if (wordCount(context.draftAnswer) > 180) {
    return true;
  }

  if (isComplexTask(context.normalizedUser)) {
    return true;
  }

  return (
    context.advisorConcerns.length > 0 ||
    context.advisorRequiredRevisions.length > 0 ||
    context.advisorMissingCounterpoints.length > 0
  );
}

function hasDirectAnswerEarly(normalizedDraft: string): boolean {
  const firstChunk = normalizedDraft.slice(0, 280);

  return containsAny(firstChunk, DIRECT_ANSWER_MARKERS);
}

function looksLikeQuestion(text: string): boolean {
  const normalized = normalizeText(text);

  if (text.includes("?")) {
    return true;
  }

  return /\b(o que|qual|quais|como|por que|porque|voce acha|você acha|esta certo|está certo|esta errado|está errado|faz sentido|what|why|how|which)\b/.test(
    normalized,
  );
}

function isComplexTask(normalizedUserInput: string): boolean {
  return containsAny(normalizedUserInput, COMPLEX_TASK_MARKERS);
}

function hasRepeatedBlocks(text: string): boolean {
  const blocks = String(text ?? "")
    .split(/\n{2,}/g)
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 32);

  if (blocks.length < 2) {
    return false;
  }

  const seen = new Set<string>();

  for (const block of blocks) {
    if (seen.has(block)) {
      return true;
    }

    seen.add(block);
  }

  return false;
}

function hasNearDuplicateBlocks(text: string): boolean {
  const blocks = String(text ?? "")
    .split(/\n{2,}/g)
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 48);

  if (blocks.length < 2) {
    return false;
  }

  for (let index = 0; index < blocks.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < blocks.length; nextIndex += 1) {
      const similarity = jaccardSimilarity(
        tokenize(blocks[index]),
        tokenize(blocks[nextIndex]),
      );

      if (similarity >= 0.88) {
        return true;
      }
    }
  }

  return false;
}

function hasRepeatedSentences(text: string): boolean {
  const sentences = String(text ?? "")
    .split(/[.!?]+/g)
    .map((sentence) => normalizeText(sentence))
    .filter((sentence) => sentence.length > 28);

  if (sentences.length < 3) {
    return false;
  }

  const seen = new Set<string>();

  for (const sentence of sentences) {
    if (seen.has(sentence)) {
      return true;
    }

    seen.add(sentence);
  }

  return false;
}

function hasMixedLanguageWithoutReason(text: string): boolean {
  const detection = detectLanguage(text);

  if (detection.language === "unknown") {
    return false;
  }

  const scores = Object.values(detection.scores).sort((a, b) => b - a);
  const [highest, secondHighest] = scores;

  if (highest < 3 || secondHighest < 3) {
    return false;
  }

  return secondHighest / Math.max(1, highest) >= 0.55;
}

function hasUnbalancedCodeFence(text: string): boolean {
  const fences = String(text ?? "").match(/```/g);

  return Boolean(fences && fences.length % 2 !== 0);
}

function hasLowParagraphStructure(text: string): boolean {
  const raw = String(text ?? "").trim();
  const paragraphs = raw.split(/\n{2,}/g).filter((entry) => entry.trim());
  const hasList = /(^|\n)\s*(?:[-*•]|\d+[.)])\s+\S+/m.test(raw);

  return paragraphs.length <= 1 && !hasList;
}

function integrityScoreToRiskLevel(
  score: number,
  checks: readonly IntegrityCheck[],
): CouncilRiskLevel {
  if (checks.some((check) => check.severity === "critical")) {
    return score <= 0.55 ? "critical" : "high";
  }

  if (score <= 0.25) return "critical";
  if (score <= 0.45) return "high";
  if (score <= 0.7) return "medium";
  return "low";
}

function detectLanguage(text: string): {
  readonly language: "pt" | "en" | "es" | "unknown";
  readonly confidence: number;
  readonly scores: Record<"pt" | "en" | "es", number>;
} {
  const normalized = normalizeText(text);

  const scores = {
    pt: countMarkerHits(normalized, [
      "voce",
      "você",
      "nao",
      "não",
      "entao",
      "então",
      "porque",
      "resposta",
      "preciso",
      "melhor",
      "certo",
      "errado",
      "texto",
    ]),
    en: countMarkerHits(normalized, [
      "the",
      "you",
      "your",
      "must",
      "should",
      "because",
      "therefore",
      "answer",
      "response",
      "correct",
      "wrong",
    ]),
    es: countMarkerHits(normalized, [
      "usted",
      "debe",
      "porque",
      "entonces",
      "respuesta",
      "necesito",
      "mejor",
      "correcto",
      "equivocado",
    ]),
  };

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<
    ["pt" | "en" | "es", number]
  >;

  const [bestLanguage, bestScore] = ranked[0];
  const [, secondBestScore] = ranked[1];

  if (bestScore <= 0) {
    return {
      language: "unknown",
      confidence: 0,
      scores,
    };
  }

  return {
    language: bestLanguage,
    confidence: round((bestScore - secondBestScore + 1) / (bestScore + 1), 3),
    scores,
  };
}

function countMarkerHits(text: string, markers: readonly string[]): number {
  return markers.reduce(
    (count, marker) => count + (containsMarker(text, marker) ? 1 : 0),
    0,
  );
}

function containsAny(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => containsMarker(text, marker));
}

function containsMarker(text: string, marker: string): boolean {
  const normalizedMarker = normalizeText(marker);

  if (!text || !normalizedMarker) {
    return false;
  }

  if (normalizedMarker.includes(" ")) {
    return text.includes(normalizedMarker);
  }

  const regex = new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "i");
  return regex.test(text);
}

function includesAny(text: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) =>
    text.includes(normalizeText(fragment)),
  );
}

function normalizeJoined(values: readonly string[]): string {
  return normalizeText(values.join(" "));
}

function normalizeText(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return tokenize(text).length;
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function jaccardSimilarity(left: readonly string[], right: readonly string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size === 0 && rightSet.size === 0) {
    return 1;
  }

  const intersectionSize = [...leftSet].filter((token) =>
    rightSet.has(token),
  ).length;

  const unionSize = new Set([...leftSet, ...rightSet]).size;

  return intersectionSize / Math.max(1, unionSize);
}

function dedupeChecks(checks: readonly IntegrityCheck[]): IntegrityCheck[] {
  const byReason = new Map<string, IntegrityCheck>();

  for (const check of checks) {
    const previous = byReason.get(check.reason);

    if (!previous) {
      byReason.set(check.reason, check);
      continue;
    }

    byReason.set(check.reason, {
      reason: check.reason,
      penalty: Math.max(previous.penalty, check.penalty),
      severity: maxRisk(previous.severity, check.severity),
    });
  }

  return Array.from(byReason.values()).sort(
    (left, right) => right.penalty - left.penalty,
  );
}

function maxRisk(
  left: CouncilRiskLevel,
  right: CouncilRiskLevel,
): CouncilRiskLevel {
  const rank: Record<CouncilRiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  return rank[left] >= rank[right] ? left : right;
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = normalizeText(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** Math.max(0, Math.floor(decimals));

  return Math.round(value * factor) / factor;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}