/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: deliberative-response-normalizer.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Centralizar a normalização textual deliberativa.
 * - Limpar artefatos de reparo, eco de prompt e vazamentos de scaffold interno.
 * - Aplicar, de forma pura e previsível, políticas de superfície vindas do contrato deliberativo.
 *
 * Função no pipeline:
 * - Este arquivo NÃO decide se uma resposta deve ser bloqueada.
 * - Este arquivo NÃO valida cobertura lógica da tarefa.
 * - Este arquivo NÃO extrai obrigações deliberativas.
 * - Este arquivo apenas transforma texto bruto em uma forma mais estável,
 *   legível e aderente à superfície desejada.
 *
 * Garantias esperadas:
 * - Redução de persona inventada na abertura da resposta.
 * - Redução de metadiscurso visível oriundo do scaffold interno.
 * - Redução de enumeração mecânica quando a política de superfície exigir.
 * - Preservação de uma forma textual mais natural, limpa e auditável.
 *
 * Observação arquitetural:
 * - Quando `surfacePolicy.blockIfAbruptlyTruncated` estiver ativa, este arquivo
 *   realiza apenas mitigação local de caudas abertas. O bloqueio definitivo
 *   continua sendo responsabilidade do integrity gate.
 */

import type { ResponseSurfacePolicy } from "./deliberative-task-contract-types";

export interface DeliberativeNormalizationOptions {
  prompt?: string | null;
  surfacePolicy?: ResponseSurfacePolicy | null;
}

export const DEFAULT_REPAIR_SURFACE_POLICY: ResponseSurfacePolicy = {
  preserveUserLanguage: true,
  forbidPersonaInjection: true,
  hideMetaInstructions: true,
  avoidEnumeratedScaffolding: true,
  preferNaturalParagraphFlow: true,
  blockIfAbruptlyTruncated: true,
};

export function normalizeDeliberativeText(text: string): string {
  return `${text || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n\n")
    .map((paragraph) => paragraph.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function normalizeForDeliberativeComparison(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripPromptEcho(text: string, prompt: string): string {
  const candidate = `${text || ""}`.trim();
  const rawPrompt = `${prompt || ""}`.trim();
  const normalizedPrompt = normalizeForDeliberativeComparison(rawPrompt);

  if (!candidate || !normalizedPrompt) {
    return candidate;
  }

  const paragraphs = candidate
    .split(/\n{2,}/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return candidate;
  }

  const promptTokens = normalizedPrompt.split(" ").filter(Boolean);
  const promptHead = promptTokens.slice(0, Math.min(promptTokens.length, 20)).join(" ");
  const normalizedFirst = normalizeForDeliberativeComparison(paragraphs[0]);

  if (!promptHead || !normalizedFirst) {
    return candidate;
  }

  const startsLikeEcho =
    normalizedFirst.startsWith(promptHead.slice(0, Math.min(promptHead.length, 64))) ||
    normalizedFirst.includes(promptHead);

  if (startsLikeEcho && paragraphs.length > 1) {
    return paragraphs.slice(1).join("\n\n").trim();
  }

  if (startsLikeEcho && rawPrompt.length >= 80) {
    const cut = Math.min(candidate.length, Math.max(80, Math.floor(rawPrompt.length * 0.88)));
    const trimmedByCut = candidate.slice(cut).trim();
    if (trimmedByCut.length >= 32) {
      return trimmedByCut;
    }
  }

  const englishRestatementLead =
    /^\s*(regarding your question|to address the question|now,?\s+let'?s|consider(?:ing)? a(?:\s+hypothetical)?\s+social system)/i.test(
      candidate,
    ) ||
    /^\s*(i(?:'m| am)\s+here to help|let me clarify some concepts)/i.test(candidate);

  const portugueseRestatementLead =
    /^\s*(consideremos um sistema social idealizado|considere um sistema social idealizado|agora suponha que|suponha agora que|faremos o seguinte|fa[cç]a o seguinte)/i.test(
      candidate,
    ) ||
    /^\s*(sem recorrer inicialmente a autores|sem recorrer a autores)/i.test(candidate);

  if (englishRestatementLead || portugueseRestatementLead) {
    const leadless = candidate
      .replace(
        /^\s*(regarding your question|to address the question|now,?\s+let'?s|consider(?:ing)? a(?:\s+hypothetical)?\s+social system|i(?:'m| am)\s+here to help|let me clarify some concepts|consideremos um sistema social idealizado|considere um sistema social idealizado|agora suponha que|suponha agora que|faremos o seguinte|fa[cç]a o seguinte|sem recorrer inicialmente a autores|sem recorrer a autores)\b[\s:,.-]*/i,
        "",
      )
      .trim();

    if (leadless.length >= 32) {
      return leadless;
    }
  }

  return candidate;
}

export function dedupeParagraphs(text: string): string {
  const paragraphs = `${text || ""}`
    .split(/\n{2,}/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    return `${text || ""}`.trim();
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    const normalized = normalizeForDeliberativeComparison(paragraph);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(paragraph);
  }

  return unique.join("\n\n").trim();
}

function stripPersonaInjectionLead(text: string): string {
  return `${text || ""}`
    .replace(/^\s*(let[ií]cia)\s*:\s*/gim, "")
    .replace(/^\s*assistant\s*:\s*/gim, "")
    .replace(/^\s*usuario\s*:\s*/gim, "")
    .replace(/^\s*eu\s+sou\s+let[ií]cia[^.?!]*[.?!]\s*/gim, "")
    .replace(/^\s*i(?:'m| am)\s+let[ií]cia[^.?!]*[.?!]\s*/gim, "")
    .replace(/^\s*my name is let[ií]cia[^.?!]*[.?!]\s*/gim, "")
    .trim();
}

function stripVisibleMetaInstructionLead(text: string): string {
  let output = `${text || ""}`.trim();

  output = output
    .replace(
      /^\s*(regarding your question|to address (?:your|the) question|now,?\s+let'?s\s+consider)\b[\s,:-]*/gim,
      "",
    )
    .replace(
      /^\s*(without initially referring to authors,?\s*philosophical schools,?\s*or historical examples)[^.?!]*[.?!]\s*/gim,
      "",
    )
    .replace(
      /^\s*(without referring to authors|without using historical examples|without using examples initially)[^.?!]*[.?!]\s*/gim,
      "",
    )
    .replace(
      /^\s*(consideremos um sistema social idealizado|considere um sistema social idealizado|agora suponha que|suponha agora que|faremos o seguinte|fa[cç]a o seguinte)\b[\s,:-]*/gim,
      "",
    )
    .replace(
      /^\s*(sem recorrer inicialmente a autores|sem recorrer a autores|sem recorrer inicialmente a autores, escolas filosoficas ou exemplos historicos)[^.?!]*[.?!]\s*/gim,
      "",
    )
    .replace(/^\s*(let me demonstrate|let me clarify some concepts|let me explain)\b[\s,:-]*/gim, "")
    .replace(/^\s*(vamos fazer o seguinte|vamos por partes)\b[\s,:-]*/gim, "")
    .trim();

  return output;
}

function softenEnumeratedScaffolding(text: string): string {
  const cleaned = `${text || ""}`
    .replace(/(^|\n)\s*\(([a-z0-9]+)\)\s+/gim, "$1")
    .replace(/(^|\n)\s*[a-z]\)\s+/gim, "$1")
    .replace(/(^|\n)\s*\d+\.\s+/gim, "$1")
    .trim();

  return normalizeDeliberativeText(cleaned);
}

function stripOpenEnumerationTail(text: string): string {
  return `${text || ""}`
    .replace(/\n?\s*\(([a-z0-9]+)\)\s*$/i, "")
    .replace(/\n?\s*[a-z]\)\s*$/i, "")
    .replace(/\n?\s*\d+\.\s*$/i, "")
    .trim();
}

function smoothParagraphFlow(text: string): string {
  const paragraphs = `${text || ""}`
    .split(/\n{2,}/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    return `${text || ""}`.trim();
  }

  const merged: string[] = [];

  for (const paragraph of paragraphs) {
    const shortParagraph = paragraph.length <= 50;
    const previousIndex = merged.length - 1;

    if (
      shortParagraph &&
      previousIndex >= 0 &&
      !/[.!?:]$/.test(merged[previousIndex]) &&
      !/^[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/.test(paragraph)
    ) {
      merged[previousIndex] = `${merged[previousIndex]} ${paragraph}`.trim();
      continue;
    }

    merged.push(paragraph);
  }

  return merged.join("\n\n").trim();
}

export function ensureNarrativeClosure(text: string): string {
  let output = `${text || ""}`.trim();

  if (!output) {
    return output;
  }

  output = stripOpenEnumerationTail(output);

  output = output
    .replace(
      /\b(e|ou|mas|porque|portanto|logo|assim|entao|então|and|or|but|because|therefore)\s*[:\-]?\s*$/i,
      "",
    )
    .trim();

  if (!/[.!?)]$/.test(output)) {
    output = `${output}.`;
  }

  return output;
}

export function applyResponseSurfacePolicy(
  text: string,
  surfacePolicy?: ResponseSurfacePolicy | null,
): string {
  let output = normalizeDeliberativeText(text);
  const policy = surfacePolicy ?? null;

  if (!output || !policy) {
    return output;
  }

  if (policy.forbidPersonaInjection) {
    output = stripPersonaInjectionLead(output);
  }

  if (policy.hideMetaInstructions) {
    output = stripVisibleMetaInstructionLead(output);
  }

  if (policy.avoidEnumeratedScaffolding) {
    output = softenEnumeratedScaffolding(output);
  }

  if (policy.preferNaturalParagraphFlow) {
    output = smoothParagraphFlow(output);
  }

  if (policy.blockIfAbruptlyTruncated) {
    output = stripOpenEnumerationTail(output);
  }

  return normalizeDeliberativeText(output);
}

export function normalizeDeliberativeResponse(
  text: string,
  options?: DeliberativeNormalizationOptions,
): string {
  let output = normalizeDeliberativeText(text);

  if (!output) {
    return output;
  }

  if (options?.prompt) {
    output = stripPromptEcho(output, options.prompt);
  }

  const promptWantsExplicitEnumeration = /\(\s*[a-z]\s*\)/i.test(`${options?.prompt || ""}`);
  const effectiveSurfacePolicy =
    options?.surfacePolicy && promptWantsExplicitEnumeration
      ? {
          ...options.surfacePolicy,
          avoidEnumeratedScaffolding: false,
        }
      : options?.surfacePolicy;

  output = applyResponseSurfacePolicy(output, effectiveSurfacePolicy);
  output = dedupeParagraphs(output);
  output = ensureNarrativeClosure(output);

  return normalizeDeliberativeText(output);
}

export function sanitizeRepairDraft(text: string): string {
  return normalizeDeliberativeResponse(text, {
    surfacePolicy: DEFAULT_REPAIR_SURFACE_POLICY,
  });
}

export function countSectionSignals(text: string): number {
  const markers =
    `${text || ""}`.match(/(^|\n)(#+\s+|\d+\.\s+|-\s+|\*\s+|•\s+|\([a-z0-9]+\)\s+)/gim) || [];
  return markers.length;
}
