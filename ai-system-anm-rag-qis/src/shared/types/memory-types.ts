export type CoreMemoryKind =
  | "short-term"
  | "working"
  | "episodic"
  | "semantic"
  | "long-term"
  | "process";

export type LegacyGlobalMemoryKind =
  | "procedural"
  | "perceptual"
  | "metacognitive"
  | "prospective"
  | "social"
  | "value"
  | "attention"
  | "regulatory";

export type LegacyNodularMemoryKind =
  | "nodular-state"
  | "nodular-attention"
  | "nodular-value"
  | "nodular-priming"
  | "nodular-weight";

export type MemoryKind = CoreMemoryKind | LegacyGlobalMemoryKind | LegacyNodularMemoryKind;

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  content: string;
  relevance: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface GlobalMemoryNamespaces {
  identity: string[];
  semantic: string[];
  procedural: string[];
  social: string[];
  value: string[];
  attention: string[];
  metacognitive: string[];
  prospective: string[];
  perceptual: string[];
}

export interface ModuleMemoryEntry {
  key: string;
  content: string;
  relevance: number;
}

export interface ModuleMemoryNamespace {
  moduleId: string;
  entries: ModuleMemoryEntry[];
}

export interface NodularMemoryState {
  attention: number;
  priming: number;
  value: number;
  stability: number;
  plasticity: number;
  weight: number;
  spikeHistory: number[];
}

export interface RegulatoryMemoryState {
  stressLoad: number;
  contextStability: number;
  supportDensity: number;
  recoveryMargin: number;
  readinessTrend: number;
  blockStructuralConsolidation: boolean;
}

export interface MemorySnapshot {
  records: MemoryRecord[];
  selectedRecordIds: string[];
  globalNamespaces: GlobalMemoryNamespaces;
  moduleNamespaces: ModuleMemoryNamespace[];
  nodularState: NodularMemoryState;
  regulatoryState: RegulatoryMemoryState;
  legacyRuntimeModules: Record<string, number>;
  legacyRuntimeTopModules: string[];
}
