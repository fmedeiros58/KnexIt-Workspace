import type {
  CouncilAdvisorReport,
  CouncilInput,
  CouncilRiskLevel,
} from "../council-types";
import {
  confidenceFromSignals,
  dedupeNormalized,
  maxRiskLevel,
  normalizeText,
  riskFromScore,
} from "./advisor-utils";

type SupportedLanguage = "pt" | "en" | "es" | "unknown";

type CommunicationConcernId =
  | "language_shift_detected"
  | "mixed_language_without_reason"
  | "repetition_loop_detected"
  | "sentence_repetition_detected"
  | "aggressive_tone_detected"
  | "dismissive_tone_detected"
  | "low_objectivity_signal"
  | "weak_structure_detected"
  | "excessive_verbosity_detected"
  | "insufficient_clarity_detected"
  | "missing_direct_answer_detected";

interface LanguageDetection {
  readonly language: SupportedLanguage;
  readonly confidence: number;
  readonly scores: Record<Exclude<SupportedLanguage, "unknown">, number>;
}

interface CommunicationFinding {
  readonly id: CommunicationConcernId;
  readonly risk: CouncilRiskLevel;
  readonly message: string;
  readonly requiredRevision?: string;
  readonly optionalRevision?: string;
}

const ADVISOR_ID = "communication";
const ADVISOR_NAME = "Communication Advisor";

const LANGUAGE_MARKERS: Record<
  Exclude<SupportedLanguage, "unknown">,
  readonly string[]
> = {
  pt: [
    "voce",
    "nao",
    "entao",
    "porque",
    "resposta",
    "preciso",
    "isso",
    "como",
    "para",
    "deve",
    "tambem",
    "melhor",
    "pergunta",
    "texto",
    "certo",
    "errado",
    "avaliar",
    "analise",
    "podemos",
    "ficou",
    "seria",
    "com base",
  ],
  en: [
    "the",
    "you",
    "your",
    "must",
    "should",
    "because",
    "therefore",
    "answer",
    "response",
    "need",
    "this",
    "that",
    "improve",
    "evaluate",
    "correct",
    "wrong",
    "right",
    "based on",
    "however",
    "although",
  ],
  es: [
    "usted",
    "debe",
    "porque",
    "entonces",
    "respuesta",
    "necesito",
    "esto",
    "como",
    "para",
    "tambien",
    "mejor",
    "pregunta",
    "texto",
    "correcto",
    "equivocado",
    "analizar",
    "evaluar",
    "podemos",
  ],
};

const AGGRESSIVE_TERMS = [
  "idiota",
  "ridiculo",
  "ridicula",
  "estupido",
  "estupida",
  "burro",
  "burrice",
  "nonsense",
  "stupid",
  "dumb",
  "idiot",
  "absurdo total",
];

const DISMISSIVE_PATTERNS = [
  "obviamente voce nao entendeu",
  "isso nao faz nenhum sentido",
  "e claro que esta errado",
  "basta ler",
  "qualquer pessoa perceberia",
  "obviously you did not understand",
  "this makes no sense",
];

const FILLER_PATTERNS = [
  "tipo assim",
  "meio que",
  "talvez talvez",
  "de certa forma meio",
  "kind of",
  "sort of",
  "maybe maybe",
  "basically basically",
];

const DIRECT_ANSWER_MARKERS = [
  "sim",
  "nao",
  "depende",
  "a resposta",
  "o ponto central",
  "em resumo",
  "conclusao",
  "correto",
  "incorreto",
  "yes",
  "no",
  "it depends",
  "the answer",
  "in summary",
  "conclusion",
];

export function runCommunicationAdvisor(
  input: CouncilInput,
): CouncilAdvisorReport {
  const userInput = input.userInput ?? "";
  const draftAnswer = input.draftAnswer ?? "";

  const findings = runCommunicationChecks({
    userInput,
    draftAnswer,
    expectedLanguage: input.userLanguage,
  });

  const concerns = dedupeNormalized(findings.map((finding) => finding.id));

  const requiredRevisions = dedupeNormalized(
    findings
      .map((finding) => finding.requiredRevision)
      .filter((revision): revision is string => Boolean(revision)),
  );

  const optionalRevisions = dedupeNormalized(
    findings
      .map((finding) => finding.optionalRevision)
      .filter((revision): revision is string => Boolean(revision)),
  );

  const risk = maxRiskLevel(findings.map((finding) => finding.risk));
  const hardSignals = findings.filter((finding) =>
    ["high", "critical"].includes(finding.risk),
  ).length;

  return {
    advisorId: ADVISOR_ID,
    advisorName: ADVISOR_NAME,
    passed: risk === "low",
    risk,
    concerns,
    strengths: risk === "low" ? buildStrengths(userInput, draftAnswer) : [],
    requiredRevisions,
    optionalRevisions,
    confidence: confidenceFromSignals(findings.length, hardSignals),
  };
}

function runCommunicationChecks(params: {
  readonly userInput: string;
  readonly draftAnswer: string;
  readonly expectedLanguage?: string;
}): CommunicationFinding[] {
  const { userInput, draftAnswer, expectedLanguage } = params;
  const findings: CommunicationFinding[] = [];

  if (!hasDraftAnswer(draftAnswer)) {
    findings.push({
      id: "insufficient_clarity_detected",
      risk: "high",
      message: "The draft answer is empty or too short to communicate a useful response.",
      requiredRevision:
        "Provide a complete response with a clear answer, explanation and conclusion.",
    });

    return findings;
  }

  const userLanguage = normalizeExpectedLanguage(expectedLanguage)
    ? {
        language: normalizeExpectedLanguage(expectedLanguage),
        confidence: 1,
        scores: { pt: 0, en: 0, es: 0 },
      }
    : detectLanguage(userInput);

  const draftLanguage = detectLanguage(draftAnswer);

  if (
    userLanguage.language !== "unknown" &&
    draftLanguage.language !== "unknown" &&
    userLanguage.language !== draftLanguage.language &&
    userLanguage.confidence >= 0.45 &&
    draftLanguage.confidence >= 0.45
  ) {
    findings.push({
      id: "language_shift_detected",
      risk: "high",
      message:
        "The draft answer appears to use a different dominant language than the user.",
      requiredRevision:
        "Respond in the user's dominant language unless the user explicitly requested another language.",
    });
  }

  if (hasMixedLanguageWithoutReason(draftAnswer)) {
    findings.push({
      id: "mixed_language_without_reason",
      risk: "medium",
      message:
        "The draft appears to mix languages without a clear user request or communicative reason.",
      requiredRevision:
        "Remove unnecessary language mixing and keep the response in one dominant language.",
    });
  }

  if (hasRepeatedBlocks(draftAnswer)) {
    findings.push({
      id: "repetition_loop_detected",
      risk: "high",
      message:
        "The draft contains repeated paragraph-level blocks, suggesting a repetition loop.",
      requiredRevision:
        "Remove repeated blocks and keep a single coherent argumentative flow.",
    });
  }

  if (hasRepeatedSentences(draftAnswer)) {
    findings.push({
      id: "sentence_repetition_detected",
      risk: "medium",
      message:
        "The draft repeats sentences or near-identical sentence units.",
      requiredRevision:
        "Remove repeated sentences and consolidate duplicated ideas into one clear statement.",
    });
  }

  if (containsAnyNormalized(draftAnswer, AGGRESSIVE_TERMS)) {
    findings.push({
      id: "aggressive_tone_detected",
      risk: "high",
      message:
        "The draft contains aggressive or disrespectful wording.",
      requiredRevision:
        "Preserve the critique, but remove aggressive, humiliating or disrespectful language.",
    });
  }

  if (containsAnyNormalized(draftAnswer, DISMISSIVE_PATTERNS)) {
    findings.push({
      id: "dismissive_tone_detected",
      risk: "medium",
      message:
        "The draft sounds dismissive and may reduce user trust.",
      requiredRevision:
        "Replace dismissive phrasing with precise, respectful and evidence-based critique.",
    });
  }

  if (containsAnyNormalized(draftAnswer, FILLER_PATTERNS)) {
    findings.push({
      id: "low_objectivity_signal",
      risk: "medium",
      message:
        "The draft contains filler expressions that weaken objectivity.",
      optionalRevision:
        "Increase objective phrasing and remove filler expressions that do not add meaning.",
    });
  }

  if (hasWeakStructure(draftAnswer)) {
    findings.push({
      id: "weak_structure_detected",
      risk: "medium",
      message:
        "The draft lacks enough structure for the apparent complexity of the answer.",
      optionalRevision:
        "Organize the response with a direct answer, concise explanation and clear conclusion.",
    });
  }

  if (isExcessivelyVerbose(userInput, draftAnswer)) {
    findings.push({
      id: "excessive_verbosity_detected",
      risk: "medium",
      message:
        "The draft is disproportionately long for the user's request.",
      optionalRevision:
        "Condense the response while preserving the necessary reasoning and conclusion.",
    });
  }

  if (hasLowClarity(draftAnswer)) {
    findings.push({
      id: "insufficient_clarity_detected",
      risk: "medium",
      message:
        "The draft has signs of low clarity, such as long overloaded sentences or weak conclusion markers.",
      requiredRevision:
        "Improve clarity by shortening overloaded sentences and making the conclusion explicit.",
    });
  }

  if (looksLikeQuestion(userInput) && lacksDirectAnswer(draftAnswer)) {
    findings.push({
      id: "missing_direct_answer_detected",
      risk: "medium",
      message:
        "The user asked a question, but the draft does not clearly provide a direct answer.",
      requiredRevision:
        "Start with a direct answer before expanding the explanation.",
    });
  }

  return dedupeFindings(findings);
}

function detectLanguage(text: string): LanguageDetection {
  const normalized = normalizeText(text);

  if (!normalized) {
    return {
      language: "unknown",
      confidence: 0,
      scores: { pt: 0, en: 0, es: 0 },
    };
  }

  const scores = {
    pt: scoreLanguage(normalized, LANGUAGE_MARKERS.pt),
    en: scoreLanguage(normalized, LANGUAGE_MARKERS.en),
    es: scoreLanguage(normalized, LANGUAGE_MARKERS.es),
  };

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<
    [Exclude<SupportedLanguage, "unknown">, number]
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

  const confidence = Math.min(
    1,
    Number(((bestScore - secondBestScore + 1) / (bestScore + 1)).toFixed(3)),
  );

  return {
    language: bestLanguage,
    confidence,
    scores,
  };
}

function scoreLanguage(
  normalizedText: string,
  markers: readonly string[],
): number {
  let score = 0;

  for (const marker of markers) {
    const normalizedMarker = normalizeText(marker);

    if (!normalizedMarker) {
      continue;
    }

    if (normalizedMarker.includes(" ")) {
      if (normalizedText.includes(normalizedMarker)) {
        score += 2;
      }

      continue;
    }

    const regex = new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "g");
    const matches = normalizedText.match(regex);

    score += matches?.length ?? 0;
  }

  return score;
}

function normalizeExpectedLanguage(
  language: string | undefined,
): SupportedLanguage | null {
  const normalized = normalizeText(language ?? "");

  if (["pt", "pt-br", "portugues", "portuguese"].includes(normalized)) {
    return "pt";
  }

  if (["en", "english", "ingles"].includes(normalized)) {
    return "en";
  }

  if (["es", "spanish", "espanhol", "espanol"].includes(normalized)) {
    return "es";
  }

  return null;
}

function hasDraftAnswer(text: string): boolean {
  return normalizeText(text).length >= 12;
}

function hasMixedLanguageWithoutReason(text: string): boolean {
  const detection = detectLanguage(text);

  if (detection.language === "unknown") {
    return false;
  }

  const sortedScores = Object.values(detection.scores).sort((a, b) => b - a);
  const [highest, secondHighest] = sortedScores;

  if (highest < 3 || secondHighest < 3) {
    return false;
  }

  return secondHighest / Math.max(1, highest) >= 0.55;
}

function hasRepeatedBlocks(text: string): boolean {
  const blocks = String(text ?? "")
    .split(/\n{2,}/g)
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length >= 40);

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

  return hasNearDuplicateBlocks(blocks);
}

function hasNearDuplicateBlocks(blocks: readonly string[]): boolean {
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
    .filter((sentence) => sentence.length >= 28);

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

function hasWeakStructure(text: string): boolean {
  const raw = String(text ?? "").trim();

  if (raw.length < 450) {
    return false;
  }

  const paragraphCount = raw.split(/\n{2,}/g).filter(Boolean).length;
  const hasListOrHeaders = /(^|\n)\s*(#{1,4}\s+|\d+[.)]\s+|- |\* )/.test(raw);
  const sentenceCount = raw.split(/[.!?]+/g).filter((s) => s.trim()).length;

  return paragraphCount <= 1 && !hasListOrHeaders && sentenceCount >= 7;
}

function isExcessivelyVerbose(userInput: string, draftAnswer: string): boolean {
  const userWords = tokenize(userInput).length;
  const draftWords = tokenize(draftAnswer).length;

  if (draftWords < 220) {
    return false;
  }

  if (userWords <= 12 && draftWords > 360) {
    return true;
  }

  return draftWords / Math.max(1, userWords) > 35;
}

function hasLowClarity(text: string): boolean {
  const sentences = String(text ?? "")
    .split(/[.!?]+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return true;
  }

  const wordCounts = sentences.map((sentence) => tokenize(sentence).length);
  const longSentenceCount = wordCounts.filter((count) => count >= 45).length;
  const averageSentenceLength =
    wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length;

  return longSentenceCount >= 2 || averageSentenceLength >= 38;
}

function looksLikeQuestion(text: string): boolean {
  const normalized = normalizeText(text);

  if (text.includes("?")) {
    return true;
  }

  const questionSignals = [
    "como",
    "qual",
    "quais",
    "o que",
    "por que",
    "porque",
    "me diga",
    "explique",
    "avalie",
    "verifique",
    "what",
    "why",
    "how",
    "which",
    "can you",
  ];

  return questionSignals.some((signal) =>
    normalized.includes(normalizeText(signal)),
  );
}

function lacksDirectAnswer(text: string): boolean {
  const normalized = normalizeText(text);
  const firstChunk = normalized.slice(0, 260);

  return !DIRECT_ANSWER_MARKERS.some((marker) =>
    firstChunk.includes(normalizeText(marker)),
  );
}

function containsAnyNormalized(
  text: string,
  patterns: readonly string[],
): boolean {
  const normalized = normalizeText(text);

  return patterns.some((pattern) => normalized.includes(normalizeText(pattern)));
}

function dedupeFindings(
  findings: readonly CommunicationFinding[],
): CommunicationFinding[] {
  const byId = new Map<CommunicationConcernId, CommunicationFinding>();

  for (const finding of findings) {
    const previous = byId.get(finding.id);

    if (!previous) {
      byId.set(finding.id, finding);
      continue;
    }

    byId.set(finding.id, {
      ...previous,
      risk: maxRiskLevel([previous.risk, finding.risk]),
      message: previous.message,
      requiredRevision:
        previous.requiredRevision ?? finding.requiredRevision,
      optionalRevision:
        previous.optionalRevision ?? finding.optionalRevision,
    });
  }

  return Array.from(byId.values());
}

function buildStrengths(userInput: string, draftAnswer: string): string[] {
  const strengths = [
    "Communication is language-consistent and does not show major repetition or tone risks.",
  ];

  if (!hasWeakStructure(draftAnswer)) {
    strengths.push("The response structure is adequate for the apparent complexity of the request.");
  }

  if (!isExcessivelyVerbose(userInput, draftAnswer)) {
    strengths.push("The response length appears proportionate to the request.");
  }

  return dedupeNormalized(strengths);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}