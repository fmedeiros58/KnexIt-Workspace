/**
 * @file anti-monoblock-gate.ts
 * @description Divide respostas longas em bloco único em parágrafos coerentes conforme o plano de layout.
 * @layer 18-presentation-and-delivery-layer
 * @purpose Evitar entrega de monoblocos que prejudicam leitura e podem mascarar cortes ou repetição em respostas profundas.
 * @inputs Texto candidato e ResponseLayoutPlan com metas de parágrafo.
 * @outputs Resultado com indicação de reparo, issues e texto repartido.
 * @dependsOn Guarda de codificação UTF-8 e contratos de layout textual.
 * @usedBy textual-output-auditor antes da serialização final.
 * @invariants A divisão deve preservar conteúdo existente; não deve inventar conclusão nem remover todo conteúdo repetido de forma destrutiva.
 * @notes Quando há repetição extrema, a porta ainda divide o texto para preservar legibilidade e permitir auditoria posterior de redundância.
 */
import { ensureUtf8Response } from "../text-encoding-guard";
import type { ResponseLayoutPlan } from "./response-layout-types";

export type AntiMonoblockGateResult = {
  triggered: boolean;
  issues: string[];
  repairedText: string;
};

function collapseWhitespace(text: string): string {
  return `${text || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripDialogueLabels(text: string): string {
  return `${text || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function stripRoleTranscriptTail(text: string): string {
  const source = `${text || ""}`.trim();
  if (!source) return "";

  const roleTailPattern = /\b(?:usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*:\s*/i;
  const match = roleTailPattern.exec(source);
  if (!match || match.index <= 0) return source;

  const head = source.slice(0, match.index).trim();
  return head || source;
}

function normalize(text: string): string {
  const utf8 = ensureUtf8Response(`${text || ""}`).text;
  return collapseWhitespace(stripRoleTranscriptTail(stripDialogueLabels(utf8)));
}

function normalizeForCompare(text: string): string {
  return `${normalize(text) || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitBySentences(text: string): string[] {
  return normalize(text)
    .split(/(?<=[.!?])\s+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function charCount(text: string): number {
  return normalize(text).length;
}

function resolveTargets(plan: ResponseLayoutPlan) {
  const minSentences = Math.max(1, plan.targetParagraphSentenceRange[0]);
  const maxSentences = Math.max(minSentences, plan.targetParagraphSentenceRange[1]);
  const minChars = Math.max(80, plan.targetParagraphCharRange[0] || 80);
  const maxChars = Math.max(minChars, plan.targetParagraphCharRange[1] || 220);

  return {
    minSentences,
    maxSentences,
    minChars,
    maxChars,
  };
}

function isDeepLike(plan: ResponseLayoutPlan): boolean {
  return (
    plan.complexity === "long" ||
    plan.complexity === "deep" ||
    plan.keepDenseParagraphs
  );
}

function shouldBreakAfterSentence(sentence: string): boolean {
  const normalized = normalize(sentence).toLowerCase();
  if (!normalized) return false;

  if (
    /^(alem disso|além disso|nesse sentido|por outro lado|no entanto|entretanto|todavia|contudo|portanto|logo|assim|ou seja|em outras palavras)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  if (
    /^(primeiro|primeiramente|segundo|terceiro|por fim|finalmente)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  if (/^(conclusao|conclusão|em sintese|em síntese|fechamento)\b/.test(normalized)) {
    return true;
  }

  return false;
}

function lexicalSimilarity(a: string, b: string): number {
  const sa = new Set(normalizeForCompare(a).split(/\s+/).filter(Boolean));
  const sb = new Set(normalizeForCompare(b).split(/\s+/).filter(Boolean));

  if (sa.size === 0 || sb.size === 0) return 0;

  let intersection = 0;
  for (const token of sa) {
    if (sb.has(token)) intersection += 1;
  }

  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : intersection / union;
}

function areNearDuplicates(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return lexicalSimilarity(na, nb) >= 0.94;
}

function dedupeSentences(sentences: string[]): string[] {
  const output: string[] = [];

  for (const sentence of sentences || []) {
    const cleaned = normalize(sentence);
    if (!cleaned) continue;

    const last = output[output.length - 1];
    if (last && areNearDuplicates(last, cleaned)) {
      continue;
    }

    output.push(cleaned);
  }

  return output;
}

function buildParagraphsFromMonoblock(
  sentences: string[],
  plan: ResponseLayoutPlan,
): string[] {
  const targets = resolveTargets(plan);
  const paragraphs: string[] = [];
  let cursor: string[] = [];

  const dedupedSentences = dedupeSentences(sentences);
  const cleanSentences = dedupedSentences.length >= 2 ? dedupedSentences : sentences.map((sentence) => normalize(sentence)).filter(Boolean);

  for (let index = 0; index < cleanSentences.length; index += 1) {
    const sentence = cleanSentences[index];
    cursor.push(sentence);

    const currentText = normalize(cursor.join(" "));
    const currentSentences = cursor.length;
    const currentChars = charCount(currentText);

    const remaining = cleanSentences.length - (index + 1);
    const nextSentence = remaining > 0 ? cleanSentences[index + 1] : "";
    const nextStartsNewMove = shouldBreakAfterSentence(nextSentence);

    const reachedMin = currentSentences >= targets.minSentences;
    const reachedTarget =
      currentSentences >= Math.min(targets.maxSentences, targets.minSentences + 1);
    const reachedMax = currentSentences >= targets.maxSentences;
    const reachedCharTarget = currentChars >= Math.round(targets.maxChars * 0.72);
    const reachedCharMax = currentChars >= Math.round(targets.maxChars * 1.08);

    const remainingTooSmall = remaining > 0 && remaining < targets.minSentences;

    const shouldFlush =
      reachedMax ||
      reachedCharMax ||
      (reachedMin && nextStartsNewMove && !remainingTooSmall) ||
      ((reachedTarget || reachedCharTarget) && !remainingTooSmall);

    if (!shouldFlush) continue;

    paragraphs.push(currentText);
    cursor = [];
  }

  if (cursor.length) {
    const tail = normalize(cursor.join(" "));
    if (tail) {
      if (paragraphs.length > 0) {
        const previous = paragraphs[paragraphs.length - 1];

        if (areNearDuplicates(previous, tail)) {
          return paragraphs.filter(Boolean);
        }

        const merged = normalize(`${previous} ${tail}`);
        const mergedSentenceCount = splitBySentences(merged).length;
        const mergedCharCount = charCount(merged);

        if (
          splitBySentences(tail).length < targets.minSentences &&
          mergedSentenceCount <= targets.maxSentences + 1 &&
          mergedCharCount <= Math.round(targets.maxChars * 1.22)
        ) {
          paragraphs[paragraphs.length - 1] = merged;
        } else {
          paragraphs.push(tail);
        }
      } else {
        paragraphs.push(tail);
      }
    }
  }

  return paragraphs.filter(Boolean);
}

function improvedEnough(source: string, repaired: string): boolean {
  if (!repaired || repaired === source) return false;

  const sourceParagraphs = source.split(/\n{2,}/g).filter(Boolean);
  const repairedParagraphs = repaired.split(/\n{2,}/g).filter(Boolean);

  if (repairedParagraphs.length <= sourceParagraphs.length) return false;

  const sourceAvg =
    sourceParagraphs.reduce((sum, paragraph) => sum + charCount(paragraph), 0) /
    Math.max(1, sourceParagraphs.length);

  const repairedAvg =
    repairedParagraphs.reduce((sum, paragraph) => sum + charCount(paragraph), 0) /
    Math.max(1, repairedParagraphs.length);

  return repairedAvg < sourceAvg * 0.9 || repairedParagraphs.length >= 2;
}

export function runAntiMonoblockGate(
  text: string,
  plan: ResponseLayoutPlan,
): AntiMonoblockGateResult {
  const source = normalize(text);
  if (!source) {
    return { triggered: false, issues: [], repairedText: source };
  }

  const alreadyMultiParagraph = /\n{2,}/.test(source);
  const deepLike = isDeepLike(plan);

  if (!deepLike || alreadyMultiParagraph || source.length < 800) {
    return { triggered: false, issues: [], repairedText: source };
  }

  const sentences = splitBySentences(source);
  if (sentences.length <= plan.targetParagraphSentenceRange[1]) {
    return { triggered: false, issues: [], repairedText: source };
  }

  const paragraphChunks = buildParagraphsFromMonoblock(sentences, plan);
  const repaired = normalize(paragraphChunks.join("\n\n"));

  if (!improvedEnough(source, repaired)) {
    return { triggered: false, issues: [], repairedText: source };
  }

  return {
    triggered: true,
    issues: ["anti_monoblock_gate_split_single_large_paragraph"],
    repairedText: repaired,
  };
}
