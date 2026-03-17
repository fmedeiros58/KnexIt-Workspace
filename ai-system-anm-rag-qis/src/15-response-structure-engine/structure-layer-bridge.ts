/**
 * Responsabilidade do arquivo:
 * - Orquestrar limpeza estrutural da resposta antes da entrega.
 * - Aplicar filtro de artefatos internos e registrar evidencias de limpeza.
 * - Encaminhar texto estruturado para normalizacao academica.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { analyzeStructure } from "./structural-analyzer";
import { enforceStructure } from "./structure-enforcer";
import { normalizeStyle } from "./style-normalizer";
import { optimizeReadability } from "./readability-optimizer";
import { controlResponseForm } from "./response-form-controller";
import { polishFinalText } from "./final-text-polisher";
import { filterInternalArtifacts } from "./internal-artifact-filter";
import { handoffStructureToAcademicNormalization } from "./structure-to-academic-normalization-bridge";

function sanitizeFallbackText(value: string): string {
  return `${value || ""}`
    .replace(/\bdetalhamento\s*:/gi, " ")
    .replace(/\bleitura alternativa\s*:/gi, " ")
    .replace(/\bconclusao\s*:/gi, " ")
    .replace(/\bevidencia[-\s]?guia\s*:[^.\n]*(?:[.?!]|$)/gi, " ")
    .replace(/\braciocinio multihipotese\s*:[^.\n]*(?:[.?!]|$)/gi, " ")
    .replace(/\bsequencia de tarefas\s*:[^.\n]*(?:[.?!]|$)/gi, " ")
    .replace(/\bstatus epistemico\s*:[^.\n]*(?:[.?!]|$)/gi, " ")
    .replace(/\bconfianca estimada\s*:[^.\n]*(?:[.?!]|$)/gi, " ")
    .replace(/\(\s*leitura [^)]+\)/gi, " ")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildStructureFallback(state: ProcessingState, preferredText: string): string {
  const candidates = [
    preferredText,
    state.collapsedTruth.summary,
    state.normalizedMessage,
    state.rawMessage,
  ];

  for (const candidate of candidates) {
    const cleaned = sanitizeFallbackText(candidate);
    if (!cleaned) continue;
    return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  }

  return "Nao foi possivel estruturar a resposta com seguranca.";
}

export async function runStructureLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const artifactFilter = filterInternalArtifacts(state.draftResponse.text);
  const structured = enforceStructure(artifactFilter.text || state.draftResponse.text);
  const styled = normalizeStyle(structured);
  const readable = optimizeReadability(styled);
  const analyzed = analyzeStructure(readable);
  const shaped = controlResponseForm(readable, {
    includeHeading: analyzed.sentenceCount > 2 && !analyzed.hasList,
    heading: "Resposta",
  });

  const polished = polishFinalText(shaped);
  const fallbackUsed = !polished.trim();
  state.structuredResponse = fallbackUsed
    ? buildStructureFallback(state, artifactFilter.text || state.draftResponse.text)
    : polished;
  if (artifactFilter.removedCount > 0) {
    state.activeConstraints = [
      ...state.activeConstraints,
      "structure_internal_artifact_removed",
      ...artifactFilter.removedSignals.map((signal) => `structure_removed:${signal}`),
    ].slice(-32);
  }
  if (fallbackUsed) {
    state.activeConstraints = [...state.activeConstraints, "structure_empty_recovered"].slice(-32);
  }
  state.userProfile = {
    ...state.userProfile,
    structureLayer: {
      artifactRemoved: artifactFilter.removedCount,
      artifactSignals: artifactFilter.removedSignals,
      fallbackUsed,
    },
  };
  state.trace.push(
    makeTraceEvent({
      layer: "structure",
      action: "response_structured",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `paragraphs=${analyzed.paragraphs.length}; sentences=${analyzed.sentenceCount}; ` +
        `artifactsRemoved=${artifactFilter.removedCount}; fallbackUsed=${fallbackUsed}`,
    }),
  );
  return handoffStructureToAcademicNormalization(state);
}
