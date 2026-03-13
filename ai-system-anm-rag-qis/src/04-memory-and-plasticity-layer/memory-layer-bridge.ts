import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { MemoryRecord } from "../shared/types/memory-types";
import { makeTraceEvent } from "../shared/utils/trace-utils";
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

function mergeUniqueRecords(records: MemoryRecord[], limit: number): MemoryRecord[] {
  const index = new Map<string, MemoryRecord>();
  for (const record of records) index.set(record.id, record);
  return Array.from(index.values()).slice(-limit);
}

export async function runMemoryLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  await runMemorySqlBridge(state);
  await runMemoryCacheBridge(state);
  await runMemoryVectorBridge(state);

  const loaded = memoryLoader({
    existingRecords: state.memorySnapshot.records,
    activeContext: state.activeContext,
    recentTurns: state.recentTurns,
  });
  const weighed = memoryPriorityWeigher({
    candidates: loaded.candidates,
    query: state.normalizedMessage,
  });
  const selected = memorySelector({
    prioritized: weighed.prioritized,
    topK: state.executionPlan.selectedRoute === "minimum" ? 4 : 6,
    minScore: 0.42,
  });
  const contextualized = memoryContextualizer({
    query: state.normalizedMessage,
    selected: selected.selected,
  });
  const injected = memoryInjectionAdapter({
    existingRecords: state.memorySnapshot.records,
    contextualized: contextualized.contextualized,
  });

  const memoryText = [
    state.normalizedMessage,
    ...contextualized.contextualized.map((item) => item.content),
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
    contextualized: contextualized.contextualized,
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

  const mergedRecords = mergeUniqueRecords(
    [...injected.records, ...projectedLegacy.synthesizedRecords, ...runtimeModules.synthesizedRecords],
    42,
  ).map((record) => ({
    ...record,
    relevance: Number(clamp01(record.relevance * relevanceGain).toFixed(4)),
  }));

  state.memorySnapshot.records = mergedRecords;
  state.memorySnapshot.selectedRecordIds = injected.selectedIds;
  state.memorySnapshot.globalNamespaces = projectedLegacy.globalNamespaces;
  state.memorySnapshot.moduleNamespaces = projectedLegacy.moduleNamespaces;
  state.memorySnapshot.nodularState = projectedLegacy.nodularState;
  state.memorySnapshot.regulatoryState = projectedLegacy.regulatoryState;
  state.memorySnapshot.legacyRuntimeModules = runtimeModules.moduleScores;
  state.memorySnapshot.legacyRuntimeTopModules = runtimeModules.topModules;

  state.activeContext = [
    ...state.activeContext,
    ...contextualized.contextualized.map((item) => item.content),
    ...projectedLegacy.globalNamespaces.semantic.slice(0, 2),
    ...projectedLegacy.globalNamespaces.procedural.slice(0, 2),
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
      ...runtimeModules.topModules.slice(0, 4).map((name) => `legacy_runtime:${name}`),
    ]),
  ].slice(-28);

  state.confidenceScores.coherence = Number(clamp01(resonanceScore).toFixed(4));
  state.confidenceScores.final = Number(
    clamp01((state.confidenceScores.retrieval * 0.45) + (state.confidenceScores.epistemic * 0.3) + (state.confidenceScores.coherence * 0.25)).toFixed(4),
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

  state.trace.push(
    makeTraceEvent({
      layer: "memory",
      action: "memory_selected",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `candidates=${loaded.candidates.length}; selected=${selected.selectedIds.length}; records=${state.memorySnapshot.records.length}; ` +
        `memoryScore=${memoryScore.toFixed(2)}; resonance=${resonanceScore.toFixed(2)}; plasticity=${plasticityScore.toFixed(2)}; ` +
        `legacyNamespaces=${Object.values(projectedLegacy.globalNamespaces).flat().length}; nodularWeight=${projectedLegacy.nodularState.weight.toFixed(2)}; ` +
        `runtimeSignal=${runtimeModules.runtimeSignal.toFixed(2)}; topModules=${runtimeModules.topModules.slice(0, 3).join(",")}`,
    }),
  );

  return handoffMemoryToKnowledge(state);
}
