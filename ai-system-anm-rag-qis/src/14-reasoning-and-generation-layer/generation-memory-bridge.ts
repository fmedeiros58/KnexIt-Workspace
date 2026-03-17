import type { ProcessingState } from "../bridges/contracts/processing-state";

function compact(value: string, maxChars = 200) {
  const safe = value.replace(/\s+/g, " ").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

export async function runGenerationMemoryBridge(state: ProcessingState): Promise<ProcessingState> {
  const selected = new Set(state.memorySnapshot.selectedRecordIds);
  const memoryContext = state.memorySnapshot.records
    .filter((record) => selected.has(record.id))
    .slice(0, 6)
    .map((record) => compact(record.content));

  const globalMemoryContext = [
    ...state.memorySnapshot.globalNamespaces.semantic,
    ...state.memorySnapshot.globalNamespaces.procedural,
    ...state.memorySnapshot.globalNamespaces.metacognitive,
    ...state.memorySnapshot.globalNamespaces.prospective,
    ...state.memorySnapshot.globalNamespaces.value,
    ...state.memorySnapshot.globalNamespaces.attention,
  ]
    .slice(0, 6)
    .map((item) => compact(item, 160));

  const moduleMemoryContext = state.memorySnapshot.moduleNamespaces
    .slice(0, 2)
    .flatMap((module) => module.entries.slice(0, 2).map((entry) => `${module.moduleId}:${compact(entry.content, 120)}`));
  const runtimeMemoryContext = state.memorySnapshot.legacyRuntimeTopModules
    .slice(0, 4)
    .map((name) => `runtime_memory:${name}`);

  const mergedContext = [
    ...memoryContext,
    ...globalMemoryContext,
    ...moduleMemoryContext,
    ...runtimeMemoryContext,
  ];

  if (mergedContext.length > 0) {
    state.activeContext = [...new Set([...state.activeContext, ...mergedContext])].slice(-20);
  }

  state.userProfile = {
    ...state.userProfile,
    generationMemory: {
      selectedCount: memoryContext.length,
      globalContextCount: globalMemoryContext.length,
      moduleContextCount: moduleMemoryContext.length,
      runtimeContextCount: runtimeMemoryContext.length,
      memoryContext,
      runtimeTopModules: state.memorySnapshot.legacyRuntimeTopModules.slice(0, 8),
      nodularState: state.memorySnapshot.nodularState,
      regulatoryState: state.memorySnapshot.regulatoryState,
    },
  };

  return state;
}
