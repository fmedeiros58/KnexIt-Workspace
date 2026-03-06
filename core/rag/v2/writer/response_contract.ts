import { inferLanguageFromText, resolveComposerLanguageDecision } from "@/core/rag/language/language_intent";

export type WriterExpectedLanguage = string;
export type WriterDetectedLanguage = string | "unknown";

export type WriterResponseContractInput = {
  prompt: string;
  answer: string;
  hasDocumentScope: boolean;
  deepMode: boolean;
};

export type WriterResponseContractReason =
  | "language_mismatch"
  | "too_short"
  | "too_few_paragraphs"
  | "repetitive_paragraphs";

export type WriterResponseContractEvaluation = {
  expectedLanguage: WriterExpectedLanguage;
  expectedLanguageName: string;
  detectedLanguage: WriterDetectedLanguage;
  detectedLanguageName: string;
  minChars: number;
  minParagraphs: number;
  paragraphCount: number;
  reasons: WriterResponseContractReason[];
};

function removeDiacritics(value: string) {
  return `${value || ""}`.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function splitParagraphs(value: string) {
  return `${value || ""}`
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((row) => row.trim())
    .filter(Boolean);
}

function hasRepetitiveParagraphs(paragraphs: string[]) {
  if (paragraphs.length < 2) return false;
  const seen = new Set<string>();
  for (const paragraph of paragraphs) {
    const normalized = removeDiacritics(paragraph.toLowerCase()).replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
    if (normalized.length < 48) continue;
    const compact = normalized.slice(0, 220);
    if (seen.has(compact)) return true;
    seen.add(compact);
  }
  return false;
}

export function evaluateWriterResponseContract(input: WriterResponseContractInput): WriterResponseContractEvaluation {
  const answer = `${input.answer || ""}`.trim();
  const paragraphs = splitParagraphs(answer);
  const expected = resolveComposerLanguageDecision(input.prompt);
  const detected = inferLanguageFromText(answer);
  const expectedLanguage = expected.id;
  const expectedLanguageName = expected.name;
  const detectedLanguage = detected?.id || "unknown";
  const detectedLanguageName = detected?.name || "desconhecido";
  const minChars = input.deepMode ? 1200 : input.hasDocumentScope ? 900 : 520;
  const minParagraphs = input.deepMode ? 5 : input.hasDocumentScope ? 4 : 2;
  const reasons: WriterResponseContractReason[] = [];

  if (detectedLanguage !== "unknown" && detectedLanguage !== expectedLanguage) {
    reasons.push("language_mismatch");
  }
  if (answer.length < minChars) {
    reasons.push("too_short");
  }
  if (paragraphs.length < minParagraphs) {
    reasons.push("too_few_paragraphs");
  }
  if (hasRepetitiveParagraphs(paragraphs)) {
    reasons.push("repetitive_paragraphs");
  }

  return {
    expectedLanguage,
    expectedLanguageName,
    detectedLanguage,
    detectedLanguageName,
    minChars,
    minParagraphs,
    paragraphCount: paragraphs.length,
    reasons,
  };
}

export function buildWriterResponseRepairInstruction(
  evaluation: WriterResponseContractEvaluation,
  options: { hasDocumentScope: boolean; deepMode: boolean },
) {
  const constraints: string[] = [`Entregue 100% da resposta em ${evaluation.expectedLanguageName}.`];

  if (evaluation.reasons.includes("language_mismatch")) {
    constraints.push(
      `O texto detectado esta em ${evaluation.detectedLanguageName}. Reescreva integralmente para ${evaluation.expectedLanguageName}.`,
    );
  }
  if (evaluation.reasons.includes("too_short")) {
    constraints.push(`Aumente a profundidade para no minimo ${evaluation.minChars} caracteres uteis.`);
  }
  if (evaluation.reasons.includes("too_few_paragraphs")) {
    constraints.push(`Use no minimo ${evaluation.minParagraphs} paragrafos coesos.`);
  }
  if (evaluation.reasons.includes("repetitive_paragraphs")) {
    constraints.push("Remova repeticoes entre paragrafos e evite duplicar a mesma ideia literal.");
  }
  if (options.deepMode) {
    constraints.push("Garanta progressao logica com abertura direta, desenvolvimento analitico e sintese final.");
  }
  if (options.hasDocumentScope) {
    constraints.push("Mantenha ancoragem factual nos trechos recuperados do documento escopado.");
  }

  return constraints.join(" ");
}

