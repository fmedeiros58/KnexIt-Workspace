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
import {
  isConversationalPrompt,
  isGreetingMessage,
  isSmallTalkMessage,
} from "../shared/utils/conversation-signals";

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
  const deepFallbackComposition = buildDeepFallbackComposition(state);
  if (deepFallbackComposition) return deepFallbackComposition;

  const sectionComposite = state.draftResponse.sections
    .map((section) => `${section.title}: ${section.content}`)
    .join("\n");
  const promptFocus = sanitizeFallbackText(state.normalizedMessage || state.rawMessage);
  const deepTurn = isDeepFallbackTurn(state);
  const candidates = [
    preferredText,
    sectionComposite,
    state.collapsedTruth.summary,
  ];

  for (const candidate of candidates) {
    const cleaned = sanitizeFallbackText(candidate);
    if (!cleaned) continue;
    if (deepTurn && isPromptEcho(cleaned, promptFocus)) continue;
    return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  }

  return "Nao foi possivel estruturar a resposta com seguranca.";
}

function isDeepFallbackTurn(state: ProcessingState): boolean {
  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!prompt) return false;
  if (state.preRouteSignals?.greetingFastLaneEligible) return false;
  if (isGreetingMessage(prompt) || isSmallTalkMessage(prompt)) return false;
  return true;
}

function isLowSignalText(value: string): boolean {
  const normalized = `${value || ""}`.toLowerCase();
  if (!normalized) return true;
  return (
    /ausencia de implicacoes/.test(normalized) ||
    /nao ha evidencias suficientes/.test(normalized) ||
    /sem implicacoes/.test(normalized) ||
    normalized.length < 60
  );
}

function normalizeEchoText(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPromptEcho(candidate: string, prompt: string): boolean {
  const a = normalizeEchoText(candidate);
  const b = normalizeEchoText(prompt);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return false;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  const ratio = overlap / Math.max(aTokens.size, bTokens.size);
  return ratio >= 0.82;
}

function buildDeepFallbackComposition(state: ProcessingState): string {
  if (!isDeepFallbackTurn(state)) return "";

  const promptFocus = sanitizeFallbackText(state.normalizedMessage || state.rawMessage);
  const summary = sanitizeFallbackText(state.collapsedTruth.summary || "");
  const implications = state.inferentialMap.implications
    .map((item) => sanitizeFallbackText(item))
    .filter((item) => item.length > 24 && !isLowSignalText(item) && !isPromptEcho(item, promptFocus))
    .slice(0, 2);
  const caveats = state.criticalCaveats
    .map((item) => sanitizeFallbackText(item))
    .filter((item) => item.length > 16)
    .slice(0, 1);
  const summaryIsPromptEcho = isPromptEcho(summary, promptFocus);

  const anchor = !isLowSignalText(summary) && !summaryIsPromptEcho
    ? summary
    : `Sobre o pedido (${promptFocus}), a resposta precisa integrar base conceitual, encadeamento inferencial e validação de consistência.`;

  const inferentialLine = implications.length > 0
    ? `Em termos inferenciais, ${implications.join(" ")}`
    : "Em termos inferenciais, é necessário explicitar premissas, consequências e critérios de validade antes de concluir.";

  const epistemicLine = caveats.length > 0
    ? `Do ponto de vista epistêmico, ${caveats[0]}`
    : "";

  const composed = [anchor, inferentialLine, epistemicLine]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return /[.!?]$/.test(composed) ? composed : `${composed}.`;
}

export async function runStructureLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const sourcePrompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const conversationalPrompt = isConversationalPrompt(sourcePrompt);
  const artifactFilter = filterInternalArtifacts(state.draftResponse.text);
  const structured = enforceStructure(artifactFilter.text || state.draftResponse.text);
  const styled = normalizeStyle(structured);
  const readable = optimizeReadability(styled);
  const analyzed = analyzeStructure(readable);
  const shaped = controlResponseForm(readable, {
    includeHeading: analyzed.sentenceCount > 2 && !analyzed.hasList && !conversationalPrompt,
    heading: "Resposta",
  });

  const polished = polishFinalText(shaped);
  const polishedText = polished.trim();
  const fallbackUsed = !polishedText;
  const shallowDeepRecovery =
    !fallbackUsed &&
    isDeepFallbackTurn(state) &&
    isLowSignalText(polishedText);
  state.structuredResponse = (fallbackUsed || shallowDeepRecovery)
    ? buildStructureFallback(state, artifactFilter.text || state.draftResponse.text)
    : polishedText;
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
  if (shallowDeepRecovery) {
    state.activeConstraints = [...state.activeConstraints, "structure_shallow_deep_recovered"].slice(-32);
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
        `artifactsRemoved=${artifactFilter.removedCount}; fallbackUsed=${fallbackUsed}; shallowDeepRecovery=${shallowDeepRecovery}`,
    }),
  );
  return handoffStructureToAcademicNormalization(state);
}
