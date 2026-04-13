/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 06-memory-and-plasticity-layer
 * Module: memory-layer-bridge
 * Responsibility: Execute memory retrieval/plasticity and apply local memory operators before knowledge handoff.
 * Primary Inputs: ProcessingState after deliberative/context preparation.
 * Primary Outputs: Updated memory snapshot, memory-facing execution artifacts and knowledge handoff.
 * Upstream Dependencies: context layer, memory runtimes, local memory operators
 * Downstream Dependencies: knowledge layer
 * Invariants: Memory modulation remains inside the memory layer; it does not bypass downstream retrieval logic.
 * Failure Modes: Missing memory signals degrade to lighter reads and suppressed writes.
 * Audit Events: memory_selected
 * Notes: Local read/write policies reduce stale carryover and indiscriminate memory persistence.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { MemoryRecord } from "../shared/types/memory-types";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { memoryLoader } from "./memory-retrieval-core/memory-loader";
import { memoryPriorityWeigher } from "./memory-retrieval-core/memory-priority-weigher";
import { memorySelector } from "./memory-retrieval-core/memory-selector";
import { memoryContextualizer } from "./memory-retrieval-core/memory-contextualizer";
import { memoryInjectionAdapter } from "./memory-retrieval-core/memory-injection-adapter";
import { episodicMemory } from "./memory-core/episodic-memory";
import { longTermMemory } from "./memory-core/long-term-memory";
import { memoryConsolidationManager } from "./memory-core/memory-consolidation-manager";
import { processMemory } from "./memory-core/process-memory";
import { semanticMemory } from "./memory-core/semantic-memory";
import { shortTermMemory } from "./memory-core/short-term-memory";
import { workingMemory } from "./memory-core/working-memory";
import { evaluateLegacyMemorySignals } from "./memory-core/legacy-memory-signals";
import { projectLegacyMemoryState } from "./memory-core/legacy-memory-projection";
import { runLegacyMemoryRuntime } from "./memory-core/legacy-memory-runtime-registry";
import { contextualResonanceDetector } from "./resonance-core/contextual-resonance-detector";
import { generalResonanceEngine } from "./resonance-core/general-resonance-engine";
import { instructionResonanceBalancer } from "./resonance-core/instruction-resonance-balancer";
import { responseResonanceController } from "./resonance-core/response-resonance-controller";
import { semanticResonanceMapper } from "./resonance-core/semantic-resonance-mapper";
import { adaptationRegulator } from "./plasticity-core/adaptation-regulator";
import { dynamicWeightAdjuster } from "./plasticity-core/dynamic-weight-adjuster";
import { memoryRelevanceUpdater } from "./plasticity-core/memory-relevance-updater";
import { patternReinforcementEngine } from "./plasticity-core/pattern-reinforcement-engine";
import { plasticityEngine } from "./plasticity-core/plasticity-engine";
import { responsivePlasticityController } from "./plasticity-core/responsive-plasticity-controller";
import { runMemorySqlBridge } from "./memory-sql-bridge";
import { runMemoryCacheBridge } from "./memory-cache-bridge";
import { runMemoryVectorBridge } from "./memory-vector-bridge";
import { handoffMemoryToKnowledge } from "./memory-to-knowledge-bridge";
import { toDisplayName } from "../shared/utils/conversation-signals";
import { memoryPressureEstimator } from "./operators/memory-pressure-estimator";
import { memoryReadPolicy } from "./operators/memory-read-policy";
import { memoryWritePolicy } from "./operators/memory-write-policy";

type TurnRole = "user" | "assistant";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function averageScore(items: Array<{ score: number }>) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + item.score, 0) / items.length;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function repairCommonMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeMemoryText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeStringArray(values: string[], limit: number): string[] {
  return (values || [])
    .map((item) => sanitizeMemoryText(item))
    .filter(Boolean)
    .slice(-limit);
}

function sanitizeRecentTurns(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
  limit = 16,
): Array<{ role: "user" | "assistant"; content: string }> {
  const sanitized: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const turn of turns || []) {
    const role: TurnRole = turn.role === "assistant" ? "assistant" : "user";
    const content = sanitizeMemoryText(turn.content);
    if (!content) continue;

    sanitized.push({
      role,
      content,
    });
  }

  return sanitized.slice(-limit);
}

function sanitizeMemoryRecords(records: MemoryRecord[], limit: number): MemoryRecord[] {
  return (records || [])
    .map((record) => ({
      ...record,
      content: sanitizeMemoryText(record.content),
    }))
    .filter((record) => Boolean(record.content))
    .slice(-limit);
}

function mergeUniqueRecords(records: MemoryRecord[], limit: number): MemoryRecord[] {
  const index = new Map<string, MemoryRecord>();
  for (const record of records) index.set(record.id, record);
  return Array.from(index.values()).slice(-limit);
}

function mergeIdentityEntries(existing: string[], preferredName: string) {
  const normalized = toDisplayName(preferredName);
  if (!normalized) return existing;
  return [
    ...new Set([
      ...existing,
      `preferred_name:${normalized}`,
      `address_user_as:${normalized}`,
    ]),
  ].slice(-10);
}

export async function runMemoryLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const memoryMode = resolveLayerModeFromState(state, "memory");

  state.normalizedMessage = sanitizeMemoryText(state.normalizedMessage || state.rawMessage);
  state.recentTurns = sanitizeRecentTurns(state.recentTurns, 16);
  state.activeContext = sanitizeStringArray(state.activeContext, 20);
  state.activeConstraints = sanitizeStringArray(state.activeConstraints, 32);

  const memoryPressure = memoryPressureEstimator(state, memoryMode);
  const readPolicy = memoryReadPolicy(state, memoryMode);
  const writePolicy = memoryWritePolicy(state, memoryMode);
  const selectedTopK =
    readPolicy.intensity === "heavy" ? 8 : readPolicy.intensity === "standard" ? 6 : 4;
  const minimumSelectionScore =
    readPolicy.intensity === "heavy" ? 0.36 : readPolicy.intensity === "standard" ? 0.42 : 0.5;

  await runMemorySqlBridge(state);
  await runMemoryCacheBridge(state);
  await runMemoryVectorBridge(state);

  const loaded = memoryLoader({
    existingRecords: sanitizeMemoryRecords(state.memorySnapshot.records, 64),
    activeContext: state.activeContext,
    recentTurns: state.recentTurns,
  });

  const weighed = memoryPriorityWeigher({
    candidates: loaded.candidates,
    query: state.normalizedMessage,
  });

  const selected = memorySelector({
    prioritized: weighed.prioritized,
    topK: state.executionPlan.selectedRoute === "minimum" ? Math.min(selectedTopK, 4) : selectedTopK,
    minScore: minimumSelectionScore,
  });

  const contextualized = memoryContextualizer({
    query: state.normalizedMessage,
    selected: selected.selected,
  });

  const sanitizedContextualized = contextualized.contextualized
    .map((item) => ({
      ...item,
      content: sanitizeMemoryText(item.content),
    }))
    .filter((item) => Boolean(item.content));

  const injected = memoryInjectionAdapter({
    existingRecords: sanitizeMemoryRecords(state.memorySnapshot.records, 64),
    contextualized: sanitizedContextualized,
  });

  const memoryText = [
    state.normalizedMessage,
    ...sanitizedContextualized.map((item) => item.content),
    ...state.activeContext.slice(-4),
  ]
    .filter(Boolean)
    .join(" ");

  const coreMemorySignals = {
    working: workingMemory({ text: memoryText }),
    shortTerm: shortTermMemory({ text: memoryText }),
    longTerm: longTermMemory({ text: memoryText }),
    episodic: episodicMemory({ text: memoryText }),
    semantic: semanticMemory({ text: memoryText }),
    process: processMemory({ text: memoryText }),
    consolidation: memoryConsolidationManager({ text: memoryText }),
  };

  const legacySignals = evaluateLegacyMemorySignals({
    text: memoryText,
    constraints: state.activeConstraints,
  });

  const memorySignals = {
    ...coreMemorySignals,
    procedural: legacySignals.legacyMemory.procedural,
    perceptual: legacySignals.legacyMemory.perceptual,
    metacognitive: legacySignals.legacyMemory.metacognitive,
    prospective: legacySignals.legacyMemory.prospective,
    social: legacySignals.legacyMemory.social,
    value: legacySignals.legacyMemory.value,
    attention: legacySignals.legacyMemory.attention,
    regulatory: legacySignals.regulatory,
    nodularAttention: legacySignals.nodular.attention,
    nodularValue: legacySignals.nodular.value,
    nodularPriming: legacySignals.nodular.priming,
    nodularState: legacySignals.nodular.state,
    nodularWeight: legacySignals.nodular.weight,
  };

  const resonanceSignals = {
    contextual: contextualResonanceDetector({ text: memoryText }),
    general: generalResonanceEngine({ text: memoryText }),
    instruction: instructionResonanceBalancer({ text: `${memoryText} ${state.activeConstraints.join(" ")}` }),
    response: responseResonanceController({ text: memoryText }),
    semantic: semanticResonanceMapper({ text: memoryText }),
  };

  const plasticitySignals = {
    plasticity: plasticityEngine({ text: memoryText }),
    adaptation: adaptationRegulator({ text: memoryText }),
    dynamicWeight: dynamicWeightAdjuster({ text: memoryText }),
    relevance: memoryRelevanceUpdater({ text: memoryText }),
    reinforcement: patternReinforcementEngine({ text: memoryText }),
    responsive: responsivePlasticityController({ text: memoryText }),
  };

  const memoryScore = averageScore(Object.values(memorySignals));
  const resonanceScore = averageScore(Object.values(resonanceSignals));
  const plasticityScore = averageScore(Object.values(plasticitySignals));
  const reinforcementRepetition = readNumber(plasticitySignals.reinforcement.context.repetition);
  const consolidationConflicts = readNumber(coreMemorySignals.consolidation.context.conflictCues);
  const instructionStrictness = readNumber(resonanceSignals.instruction.context.instructionCues);

  const projectedLegacy = projectLegacyMemoryState({
    normalizedMessage: state.normalizedMessage,
    activeContext: state.activeContext,
    contextualized: sanitizedContextualized,
    inputDomain: state.inputSignals.domain || "general",
    memoryScore,
    resonanceScore,
    plasticityScore,
    consolidationConflicts,
    legacySignals,
  });

  const runtimeModules = runLegacyMemoryRuntime({
    text: memoryText,
    constraints: state.activeConstraints,
    nodularAttention: projectedLegacy.nodularState.attention,
    nodularValue: projectedLegacy.nodularState.value,
    nodularPriming: projectedLegacy.nodularState.priming,
    regulatoryStress: projectedLegacy.regulatoryState.stressLoad,
    regulatoryStability: projectedLegacy.regulatoryState.contextStability,
  });

  const structuralPenalty = projectedLegacy.regulatoryState.blockStructuralConsolidation ? 0.82 : 1;
  const relevanceGain = clamp01(
    (
      0.9 +
      (plasticityScore * 0.18) +
      Math.min(0.06, reinforcementRepetition * 0.12) -
      Math.min(0.08, consolidationConflicts * 0.04)
    ) * structuralPenalty,
  );

  const synthesizedWriteBackRecords = writePolicy.shouldWrite
    ? [...projectedLegacy.synthesizedRecords, ...runtimeModules.synthesizedRecords]
    : [];

  const mergedRecords = mergeUniqueRecords(
    sanitizeMemoryRecords(
      [...injected.records, ...synthesizedWriteBackRecords].map((record) => ({
        ...record,
        content: sanitizeMemoryText(record.content),
      })),
      42,
    ),
    42,
  ).map((record) => ({
    ...record,
    relevance: Number(clamp01(record.relevance * relevanceGain).toFixed(4)),
  }));

  state.memorySnapshot.records = mergedRecords;
  state.memorySnapshot.selectedRecordIds = injected.selectedIds;

  const preferredName =
    typeof state.userProfile.preferredName === "string"
      ? toDisplayName(state.userProfile.preferredName)
      : "";

  state.memorySnapshot.globalNamespaces = {
    ...projectedLegacy.globalNamespaces,
    identity: mergeIdentityEntries(projectedLegacy.globalNamespaces.identity, preferredName),
  };
  state.memorySnapshot.moduleNamespaces = projectedLegacy.moduleNamespaces;
  state.memorySnapshot.nodularState = projectedLegacy.nodularState;
  state.memorySnapshot.regulatoryState = projectedLegacy.regulatoryState;
  state.memorySnapshot.legacyRuntimeModules = runtimeModules.moduleScores;
  state.memorySnapshot.legacyRuntimeTopModules = runtimeModules.topModules;

  state.activeContext = [
    ...state.activeContext,
    ...sanitizeStringArray(sanitizedContextualized.map((item) => item.content), 8),
    ...(writePolicy.shouldWrite ? sanitizeStringArray(projectedLegacy.globalNamespaces.semantic.slice(0, 2), 2) : []),
    ...(writePolicy.shouldWrite ? sanitizeStringArray(projectedLegacy.globalNamespaces.procedural.slice(0, 2), 2) : []),
    ...(preferredName ? [`Nome preferido do usuario: ${preferredName}.`] : []),
  ].slice(-16);

  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...(resonanceScore < 0.4 ? ["memory_resonance_low"] : ["memory_resonance_ok"]),
      ...(plasticityScore >= 0.68 ? ["memory_plasticity_adaptive"] : []),
      ...(instructionStrictness >= 2 ? ["memory_instruction_strict"] : []),
      ...(consolidationConflicts >= 2 ? ["memory_conflict_detected"] : []),
      "legacy_memory_taxonomy_migrated",
      ...(projectedLegacy.regulatoryState.blockStructuralConsolidation ? ["memory_regulatory_block"] : []),
      ...(projectedLegacy.nodularState.attention >= 0.68 ? ["memory_attention_peak"] : []),
      ...(runtimeModules.runtimeSignal >= 0.65 ? ["legacy_runtime_memory_high_signal"] : []),
      `memory_read_intensity:${readPolicy.intensity}`,
      ...(writePolicy.shouldWrite ? ["memory_write_allowed"] : ["memory_write_suppressed"]),
      ...runtimeModules.topModules.slice(0, 4).map((name) => `legacy_runtime:${name}`),
    ]),
  ].slice(-28);

  state.confidenceScores.coherence = Number(clamp01(resonanceScore).toFixed(4));
  state.confidenceScores.final = Number(
    clamp01(
      (state.confidenceScores.retrieval * 0.45) +
      (state.confidenceScores.epistemic * 0.3) +
      (state.confidenceScores.coherence * 0.25),
    ).toFixed(4),
  );

  state.userProfile = {
    ...state.userProfile,
    memoryScore: Number(clamp01((memoryScore * 0.86) + (runtimeModules.runtimeSignal * 0.14)).toFixed(4)),
    resonanceScore: Number(resonanceScore.toFixed(4)),
    plasticityScore: Number(plasticityScore.toFixed(4)),
    legacyMemorySignals: {
      procedural: legacySignals.legacyMemory.procedural.score,
      perceptual: legacySignals.legacyMemory.perceptual.score,
      metacognitive: legacySignals.legacyMemory.metacognitive.score,
      prospective: legacySignals.legacyMemory.prospective.score,
      social: legacySignals.legacyMemory.social.score,
      value: legacySignals.legacyMemory.value.score,
      attention: legacySignals.legacyMemory.attention.score,
      regulatory: legacySignals.regulatory.score,
      nodularWeight: legacySignals.nodular.weight.score,
    },
    legacyRuntimeMemory: {
      runtimeSignal: runtimeModules.runtimeSignal,
      topModules: runtimeModules.topModules.slice(0, 8),
    },
  };

  state.executionArtifacts = {
    ...state.executionArtifacts,
    memory: {
      operatorMode: memoryMode,
      pressureScore: memoryPressure.score,
      pressureBand: memoryPressure.band,
      readIntensity: readPolicy.intensity,
      shouldWrite: writePolicy.shouldWrite,
      selectedTopK,
    },
  };

  state.trace.push(
    makeTraceEvent({
      layer: "memory",
      action: "memory_selected",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `mode=${memoryMode}; candidates=${loaded.candidates.length}; selected=${selected.selectedIds.length}; records=${state.memorySnapshot.records.length}; ` +
        `pressure=${memoryPressure.score.toFixed(2)}; read=${readPolicy.intensity}; write=${writePolicy.shouldWrite}; ` +
        `memoryScore=${memoryScore.toFixed(2)}; resonance=${resonanceScore.toFixed(2)}; plasticity=${plasticityScore.toFixed(2)}; ` +
        `legacyNamespaces=${Object.values(projectedLegacy.globalNamespaces).flat().length}; nodularWeight=${projectedLegacy.nodularState.weight.toFixed(2)}; ` +
        `runtimeSignal=${runtimeModules.runtimeSignal.toFixed(2)}; topModules=${runtimeModules.topModules.slice(0, 3).join(",")}`,
    }),
  );

  return handoffMemoryToKnowledge(state);
}