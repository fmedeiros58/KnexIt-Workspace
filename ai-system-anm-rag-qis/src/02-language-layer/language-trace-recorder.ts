/**
 * Responsabilidade do arquivo:
 * - Registrar trace sintetico do processamento linguistico para auditabilidade.
 * - Consolidar sinais-chave de idioma, ambiguidade, fala e estilo em um unico evento.
 * - Isolar montagem de detalhe de trace do bridge principal.
 */
import type { ProcessingTraceEvent } from "../shared/types/common-types";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import type { LanguageState } from "./types/language-types";

export interface LanguageTraceRecorderInput {
  route: "minimum" | "reflective" | "inferential" | "quantum-state";
  latencyMs: number;
  languageState: LanguageState;
}

export function languageTraceRecorder(input: LanguageTraceRecorderInput): ProcessingTraceEvent {
  const state = input.languageState;
  return makeTraceEvent({
    layer: "language",
    action: "language_state_built",
    route: input.route,
    latencyMs: input.latencyMs,
    detail: [
      `language=${state.locale}`,
      `speechAct=${state.speechAct}`,
      `intent=${state.pragmaticIntent}`,
      `ambiguity=${state.ambiguity.toFixed(2)}`,
      `tone=${state.tone}`,
      `urgency=${state.urgency}`,
      `mixed=${state.mixedLanguage}`,
    ].join("; "),
  });
}

