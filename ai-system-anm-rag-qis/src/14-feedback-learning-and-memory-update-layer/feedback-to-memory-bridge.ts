import type { ProcessingState } from "../bridges/contracts/processing-state";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function handoffFeedbackToMemory(state: ProcessingState): ProcessingState {
  const selected = new Set(state.memorySnapshot.selectedRecordIds);
  const accepted = state.validationReport.quality.decision === "accept";
  const reward = accepted ? 0.05 : -0.08;
  state.memorySnapshot.records = state.memorySnapshot.records.map((record) => {
    if (!selected.has(record.id)) return record;
    return {
      ...record,
      relevance: Number(clamp01(record.relevance + reward).toFixed(4)),
    };
  });
  const runtimeModules = state.memorySnapshot.legacyRuntimeModules || {};
  const runtimeKeys = Object.keys(runtimeModules);
  if (runtimeKeys.length) {
    const runtimeDelta = accepted ? 0.03 : -0.05;
    state.memorySnapshot.legacyRuntimeModules = runtimeKeys.reduce<Record<string, number>>((acc, key) => {
      const current = runtimeModules[key] || 0;
      const next = selected.size ? current + runtimeDelta : current + (runtimeDelta * 0.4);
      acc[key] = Number(clamp01(next).toFixed(4));
      return acc;
    }, {});
    state.memorySnapshot.legacyRuntimeTopModules = Object.entries(state.memorySnapshot.legacyRuntimeModules)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);
  }
  const nodularDelta = accepted ? 0.04 : -0.05;
  state.memorySnapshot.nodularState = {
    ...state.memorySnapshot.nodularState,
    attention: Number(clamp01(state.memorySnapshot.nodularState.attention + nodularDelta).toFixed(4)),
    priming: Number(clamp01(state.memorySnapshot.nodularState.priming + (nodularDelta * 0.9)).toFixed(4)),
    value: Number(clamp01(state.memorySnapshot.nodularState.value + (accepted ? 0.03 : -0.04)).toFixed(4)),
    stability: Number(clamp01(state.memorySnapshot.nodularState.stability + (accepted ? 0.05 : -0.06)).toFixed(4)),
    plasticity: Number(clamp01(state.memorySnapshot.nodularState.plasticity + (accepted ? 0.04 : -0.03)).toFixed(4)),
    weight: Number(clamp01(state.memorySnapshot.nodularState.weight + (accepted ? 0.03 : -0.04)).toFixed(4)),
    spikeHistory: [...state.memorySnapshot.nodularState.spikeHistory, Number((accepted ? 1 : -1).toFixed(2))].slice(-12),
  };
  state.memorySnapshot.regulatoryState = {
    ...state.memorySnapshot.regulatoryState,
    stressLoad: Number(clamp01(state.memorySnapshot.regulatoryState.stressLoad + (accepted ? -0.05 : 0.07)).toFixed(4)),
    contextStability: Number(clamp01(state.memorySnapshot.regulatoryState.contextStability + (accepted ? 0.04 : -0.05)).toFixed(4)),
    supportDensity: Number(clamp01(state.memorySnapshot.regulatoryState.supportDensity + (accepted ? 0.04 : -0.03)).toFixed(4)),
    recoveryMargin: Number(clamp01(state.memorySnapshot.regulatoryState.recoveryMargin + (accepted ? 0.03 : -0.04)).toFixed(4)),
    readinessTrend: Number(
      Math.max(-1, Math.min(1, state.memorySnapshot.regulatoryState.readinessTrend + (accepted ? 0.08 : -0.1))).toFixed(4),
    ),
    blockStructuralConsolidation:
      clamp01(state.memorySnapshot.regulatoryState.stressLoad + (accepted ? -0.05 : 0.07)) >= 0.78 &&
      clamp01(state.memorySnapshot.regulatoryState.contextStability + (accepted ? 0.04 : -0.05)) <= 0.32,
  };

  return state;
}
