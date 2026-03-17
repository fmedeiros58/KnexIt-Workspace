/**
 * Responsabilidade do arquivo:
 * - Definir ordem e intensidade das normalizacoes linguisticas por prioridade.
 * - Executar pipeline completo de estabilizacao textual com trilha de passos.
 * - Entregar texto estabilizado e forma canonica para o LanguageState.
 */
import type { NormalizationAction } from "../types/language-types";
import { canonicalizer } from "./canonicalizer";
import { casingNormalizer } from "./casing-normalizer";
import { diacriticNormalizer } from "./diacritic-normalizer";
import { orthographicNormalizer } from "./orthographic-normalizer";
import { punctuationNormalizer } from "./punctuation-normalizer";
import { surfaceCleaner } from "./surface-cleaner";
import { tokenBoundaryNormalizer } from "./token-boundary-normalizer";
import { typoRepair } from "./typo-repair";
import { whitespaceNormalizer } from "./whitespace-normalizer";

export interface NormalizationPriorityEngineInput {
  text: string;
}

export interface NormalizationPriorityEngineResult {
  stabilizedText: string;
  canonicalText: string;
  steps: NormalizationAction[];
}

function toAction(step: string, before: string, after: string): NormalizationAction {
  return {
    step,
    before,
    after,
    changed: before !== after,
  };
}

export function normalizationPriorityEngine(input: NormalizationPriorityEngineInput): NormalizationPriorityEngineResult {
  const actions: NormalizationAction[] = [];
  let current = `${input.text || ""}`;

  const inSequence: ReadonlyArray<{
    name: string;
    apply: (text: string) => { text: string };
  }> = [
    { name: "surface-cleaner", apply: (text) => surfaceCleaner({ text }) },
    { name: "whitespace-normalizer", apply: (text) => whitespaceNormalizer({ text }) },
    { name: "token-boundary-normalizer", apply: (text) => tokenBoundaryNormalizer({ text }) },
    { name: "diacritic-normalizer", apply: (text) => diacriticNormalizer({ text }) },
    { name: "typo-repair", apply: (text) => typoRepair({ text }) },
    { name: "orthographic-normalizer", apply: (text) => orthographicNormalizer({ text }) },
    { name: "punctuation-normalizer", apply: (text) => punctuationNormalizer({ text }) },
    { name: "casing-normalizer", apply: (text) => casingNormalizer({ text }) },
  ];

  for (const step of inSequence) {
    const before = current;
    const after = step.apply(current).text;
    current = after;
    actions.push(toAction(step.name, before, after));
  }

  const canonical = canonicalizer({ text: current });
  return {
    stabilizedText: current,
    canonicalText: canonical.canonicalText,
    steps: actions,
  };
}

