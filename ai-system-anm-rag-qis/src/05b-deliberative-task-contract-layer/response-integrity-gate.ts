/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: response-integrity-gate.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Avaliar se a resposta deliberativa final possui integridade mínima para seguir adiante.
 * - Detectar truncamento, cauda abrupta, enumeração inacabada, vazamentos superficiais
 *   e sinais de resposta estruturalmente insuficiente para a carga obrigacional esperada.
 *
 * Função no pipeline:
 * - Este arquivo NÃO normaliza texto.
 * - Este arquivo NÃO reescreve a resposta.
 * - Este arquivo NÃO decide cobertura lógica detalhada das obrigações.
 * - Este arquivo atua como gate final de integridade textual e superficial antes da entrega.
 *
 * Entradas:
 * - responseText: texto final a ser inspecionado.
 * - expectedObligations: quantidade esperada de obrigações para a tarefa.
 * - satisfiedObligations: quantidade de obrigações efetivamente satisfeitas.
 * - surfacePolicy: política opcional de superfície usada para endurecer certos checks.
 *
 * Saída:
 * - ResponseIntegrityResult contendo:
 *   - flags de truncamento e término abrupto;
 *   - seções/obrigações ausentes;
 *   - lista de issues detectadas;
 *   - indicador final de aprovação.
 *
 * Garantias esperadas:
 * - Bloquear resposta vazia ou claramente truncada.
 * - Detectar enumeração aberta ou incompleta.
 * - Detectar persona inventada e metadiscurso visível quando incompatíveis com a política.
 * - Sinalizar respostas curtas demais para a complexidade obrigacional esperada.
 *
 * Observação arquitetural:
 * - O normalizer deve tentar mitigar artefatos.
 * - Este gate existe para impedir que artefatos remanescentes escapem para a entrega final.
 */

import type { ResponseSurfacePolicy } from "./deliberative-task-contract-types";

export interface ResponseIntegrityResult {
  isTruncated: boolean;
  hasAbruptEnding: boolean;
  missingSections: string[];
  issues: string[];
  passed: boolean;
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasUnbalancedPairs(text: string): boolean {
  const openParen = (text.match(/\(/g) || []).length;
  const closeParen = (text.match(/\)/g) || []).length;
  const enumerativeCloseParen = (
    text.match(/(?:^|[\s.:;,-])(?:\d+|[a-z])\)/gim) || []
  ).length;
  const openBracket = (text.match(/\[/g) || []).length;
  const closeBracket = (text.match(/\]/g) || []).length;
  const openBrace = (text.match(/{/g) || []).length;
  const closeBrace = (text.match(/}/g) || []).length;

  const adjustedCloseParen = Math.max(0, closeParen - enumerativeCloseParen);

  return (
    openParen !== adjustedCloseParen ||
    openBracket !== closeBracket ||
    openBrace !== closeBrace
  );
}

function hasDanglingConnectorEnding(text: string): boolean {
  return /\b(e|ou|mas|porque|portanto|logo|assim|entao|então|and|or|but|because|therefore)\s*[:\-]?\s*$/i.test(
    `${text || ""}`,
  );
}

function hasLikelyCutWordEnding(text: string): boolean {
  const trimmed = `${text || ""}`.trim();

  if (!trimmed || /[.!?)]$/.test(trimmed)) {
    return false;
  }

  const match = trimmed.match(/([a-zA-Z\u00C0-\u017F]{3,12})$/);
  if (!match) {
    return false;
  }

  const ending = `${match[1] || ""}`.toLowerCase();
  const safeEndings = new Set([
    "sim",
    "não",
    "nao",
    "ok",
    "fim",
    "bom",
    "ruim",
    "alto",
    "baixa",
    "baixo",
    "média",
    "media",
    "claro",
    "certo",
  ]);

  return !safeEndings.has(ending);
}

function hasTerminalQuoteWithoutClosure(text: string): boolean {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return false;
  const last = trimmed.slice(-1);
  if (!["\"", "'", "”", "’", "»"].includes(last)) return false;
  const before = trimmed.slice(0, -1).trim();
  if (!before) return true;
  return !/[.!?)]$/.test(before);
}

function hasMojibakeSurface(text: string): boolean {
  const source = `${text || ""}`;
  if (!source) return false;
  const hits = source.match(/(?:Ã[\x80-\xBF]|Â[\x80-\xBF]|ï¿½|�)/g) || [];
  return hits.length >= 2;
}

function hasOpenEnumerativeLead(text: string): boolean {
  return /\b(modelo|alternativa|item|secao|seção|section)\s*\d*\s*[:\-]\s*$/i.test(`${text || ""}`);
}

function hasDanglingTerminalEnumerationMarker(text: string): boolean {
  return /\(\s*[a-z0-9]+\s*\)\s*$/.test(`${text || ""}`) || /\b[a-z]\)\s*$/.test(`${text || ""}`);
}

function hasUnfinishedEnumeratedSequence(text: string, expectedObligations: number): boolean {
  if (expectedObligations < 2) {
    return false;
  }

  const alphaLabels = (text.match(/\(\s*[a-z]\s*\)/gi) || [])
    .map((item) => item.replace(/[^a-z]/gi, "").toLowerCase())
    .filter(Boolean);

  const numericLabels = (text.match(/\(\s*\d+\s*\)/g) || [])
    .map((item) => Number(item.replace(/[^\d]/g, "")))
    .filter((value) => Number.isFinite(value));

  if (alphaLabels.length > 0) {
    const highest = alphaLabels.reduce((acc, label) => Math.max(acc, label.charCodeAt(0) - 96), 0);
    if (highest < Math.min(expectedObligations, 9)) {
      return true;
    }
  }

  if (numericLabels.length > 0) {
    const highest = numericLabels.reduce((acc, value) => Math.max(acc, value), 0);
    if (highest < Math.min(expectedObligations, 9)) {
      return true;
    }
  }

  return false;
}

function hasPromptRestatementSurface(text: string): boolean {
  return /\b(the problem statement describes|please do the following|let me clarify some concepts|regarding your question|to address the question|consideremos um sistema social idealizado|considere um sistema social idealizado|agora suponha|faremos o seguinte|sem recorrer inicialmente a autores)\b/i.test(`${text || ""}`);
}

function hasPersonaInjectionSurface(text: string): boolean {
  return /^\s*(eu\s+sou\s+let[ií]cia|i(?:'m| am)\s+let[ií]cia|my name is let[ií]cia)\b/i.test(
    `${text || ""}`,
  );
}

function hasVisibleMetaInstructionSurface(text: string): boolean {
  return /^\s*(without initially referring to authors|without referring to authors|without using historical examples|let me demonstrate)\b/i.test(
    `${text || ""}`,
  );
}

function shouldFlagMissingTerminalPunctuation(text: string): boolean {
  const trimmed = `${text || ""}`.trim();

  if (!trimmed) {
    return false;
  }

  if (/[.!?)]$/.test(trimmed)) {
    return false;
  }

  if (trimmed.length < 24) {
    return false;
  }

  return true;
}

export function checkResponseIntegrity(params: {
  responseText: string;
  expectedObligations?: number;
  satisfiedObligations?: number;
  surfacePolicy?: ResponseSurfacePolicy | null;
}): ResponseIntegrityResult {
  const responseText = `${params.responseText || ""}`.trim();
  const expectedObligations = params.expectedObligations || 0;
  const satisfiedObligations = params.satisfiedObligations;
  const surfacePolicy = params.surfacePolicy ?? null;

  if (!responseText) {
    return {
      isTruncated: true,
      hasAbruptEnding: true,
      missingSections: ["empty_response"],
      issues: ["empty_response"],
      passed: false,
    };
  }

  const normalized = normalize(responseText);
  const issues: string[] = [];

  const hasAbruptEnding =
    /[:;,\-]$/.test(responseText) ||
    hasDanglingConnectorEnding(responseText) ||
    hasLikelyCutWordEnding(responseText) ||
    hasTerminalQuoteWithoutClosure(responseText) ||
    hasOpenEnumerativeLead(responseText) ||
    hasDanglingTerminalEnumerationMarker(responseText);

  if (hasAbruptEnding) {
    issues.push("abrupt_or_open_ending");
  }

  if (hasUnbalancedPairs(responseText)) {
    issues.push("unbalanced_symbols");
  }

  if (responseText.includes("ï¿½") || responseText.includes("�")) {
    issues.push("replacement_char_detected");
  }

  if (hasMojibakeSurface(responseText)) {
    issues.push("mojibake_surface_detected");
  }

  if (shouldFlagMissingTerminalPunctuation(responseText)) {
    issues.push("missing_terminal_punctuation");
  }

  if (hasUnfinishedEnumeratedSequence(responseText, expectedObligations)) {
    issues.push("unfinished_enumerated_sequence");
  }

  if (hasDanglingTerminalEnumerationMarker(responseText)) {
    issues.push("dangling_terminal_enumeration_marker");
  }

  if (hasPromptRestatementSurface(responseText)) {
    issues.push("prompt_restatement_surface_detected");
  }

  if (surfacePolicy?.forbidPersonaInjection && hasPersonaInjectionSurface(responseText)) {
    issues.push("persona_injection_surface_detected");
  }

  if (surfacePolicy?.hideMetaInstructions && hasVisibleMetaInstructionSurface(responseText)) {
    issues.push("visible_meta_instruction_surface_detected");
  }

  const missingSections: string[] = [];
  if (
    typeof expectedObligations === "number" &&
    typeof satisfiedObligations === "number" &&
    satisfiedObligations < expectedObligations
  ) {
    missingSections.push("unsatisfied_obligations");
  }

  if (normalized.length < 80 && expectedObligations >= 2) {
    issues.push("underdeveloped_for_expected_obligations");
  }

  const isTruncated =
    issues.includes("abrupt_or_open_ending") ||
    issues.includes("unbalanced_symbols") ||
    issues.includes("replacement_char_detected") ||
    issues.includes("mojibake_surface_detected") ||
    issues.includes("unfinished_enumerated_sequence") ||
    issues.includes("dangling_terminal_enumeration_marker") ||
    issues.includes("missing_terminal_punctuation");

  const passed = isTruncated === false && missingSections.length === 0 && issues.length === 0;

  return {
    isTruncated,
    hasAbruptEnding,
    missingSections,
    issues,
    passed,
  };
}
