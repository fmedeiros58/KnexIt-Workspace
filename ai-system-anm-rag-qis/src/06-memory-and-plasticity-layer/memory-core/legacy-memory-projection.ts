import type {
  GlobalMemoryNamespaces,
  MemoryRecord,
  ModuleMemoryNamespace,
  NodularMemoryState,
  RegulatoryMemoryState,
} from "../../shared/types/memory-types";
import type { LegacyMemorySignalsOutput } from "./legacy-memory-signals";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function compactLine(value: string, maxChars = 220) {
  const safe = value.replace(/\s+/g, " ").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

function uniqueNonEmpty(values: string[], limit: number) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const compact = compactLine(value);
    if (!compact || seen.has(compact)) continue;
    seen.add(compact);
    out.push(compact);
    if (out.length >= limit) break;
  }
  return out;
}

function makeStableId(prefix: string, content: string) {
  const base = `${prefix}-${content.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(0, 58);
  return `${base}-${Math.abs(content.length % 97)}`;
}

function pickNamespaceEntries(seed: string[], pattern: RegExp, fallbackCount = 2) {
  const matched = seed.filter((item) => pattern.test(item.toLowerCase()));
  if (matched.length >= fallbackCount) return uniqueNonEmpty(matched, 4);
  return uniqueNonEmpty([...matched, ...seed], 4);
}

export interface LegacyMemoryProjectionInput {
  normalizedMessage: string;
  activeContext: string[];
  contextualized: Array<{ id: string; content: string; relevance: number }>;
  inputDomain: string;
  memoryScore: number;
  resonanceScore: number;
  plasticityScore: number;
  consolidationConflicts: number;
  legacySignals: LegacyMemorySignalsOutput;
}

export interface LegacyMemoryProjectionOutput {
  globalNamespaces: GlobalMemoryNamespaces;
  moduleNamespaces: ModuleMemoryNamespace[];
  nodularState: NodularMemoryState;
  regulatoryState: RegulatoryMemoryState;
  synthesizedRecords: MemoryRecord[];
}

export function projectLegacyMemoryState(input: LegacyMemoryProjectionInput): LegacyMemoryProjectionOutput {
  const seed = uniqueNonEmpty(
    [
      input.normalizedMessage,
      ...input.contextualized.map((item) => item.content),
      ...input.activeContext,
    ],
    16,
  );

  const globalNamespaces: GlobalMemoryNamespaces = {
    identity: pickNamespaceEntries(seed, /\b(eu|meu|minha|usuario|perfil|identidade|prefiro|gosto)\b/i, 1),
    semantic: pickNamespaceEntries(seed, /\b(defin|conceit|significa|explica|refer|fato|evid)\w*/i, 2),
    procedural: pickNamespaceEntries(seed, /\b(passo|etapa|proced|workflow|script|roteiro)\w*/i, 2),
    social: pickNamespaceEntries(seed, /\b(usuario|cliente|equipe|time|stakeholder|pessoa)\w*/i, 1),
    value: pickNamespaceEntries(seed, /\b(valor|impacto|beneficio|prioridade|custo|risco)\w*/i, 1),
    attention: pickNamespaceEntries(seed, /\b(foco|urgente|importante|critico|prioriz)\w*/i, 1),
    metacognitive: pickNamespaceEntries(seed, /\b(assum|hipot|incerteza|limita|tradeoff|critic)\w*/i, 1),
    prospective: pickNamespaceEntries(seed, /\b(proximo|futuro|depois|roadmap|planej)\w*/i, 1),
    perceptual: pickNamespaceEntries(seed, /\b(imagem|visual|audio|tom|layout|ux|ui|perce)\w*/i, 1),
  };

  const domain = (input.inputDomain || "general").trim().toLowerCase();
  const moduleNamespaces: ModuleMemoryNamespace[] = [
    {
      moduleId: domain || "general",
      entries: input.contextualized.slice(-6).map((item) => ({
        key: item.id,
        content: compactLine(item.content, 180),
        relevance: Number(clamp01(item.relevance).toFixed(4)),
      })),
    },
  ];

  const nodularAttention = input.legacySignals.nodular.attention.score;
  const nodularPriming = input.legacySignals.nodular.priming.score;
  const nodularValue = input.legacySignals.nodular.value.score;
  const nodularWeight = input.legacySignals.nodular.weight.score;
  const nodularStability = clamp01(
    (input.memoryScore * 0.36) +
    (input.resonanceScore * 0.44) -
    Math.min(0.22, input.consolidationConflicts * 0.07),
  );

  const nodularState: NodularMemoryState = {
    attention: Number(nodularAttention.toFixed(4)),
    priming: Number(nodularPriming.toFixed(4)),
    value: Number(nodularValue.toFixed(4)),
    stability: Number(nodularStability.toFixed(4)),
    plasticity: Number(clamp01(input.plasticityScore).toFixed(4)),
    weight: Number(nodularWeight.toFixed(4)),
    spikeHistory: [
      nodularAttention,
      nodularPriming,
      nodularValue,
      nodularStability,
      input.plasticityScore,
    ].map((item) => Number(clamp01(item).toFixed(4))),
  };

  const stressLoad = clamp01(
    (input.legacySignals.regulatory.score * 0.58) +
    Math.min(0.24, input.consolidationConflicts * 0.08),
  );
  const contextStability = clamp01((input.resonanceScore * 0.62) + (input.memoryScore * 0.38));
  const supportDensity = clamp01((input.memoryScore * 0.44) + (input.plasticityScore * 0.36) + (nodularAttention * 0.2));
  const recoveryMargin = clamp01(((1 - stressLoad) * 0.52) + (supportDensity * 0.48));
  const readinessTrend = clampSigned(((input.plasticityScore + nodularStability) / 2) - 0.5);

  const regulatoryState: RegulatoryMemoryState = {
    stressLoad: Number(stressLoad.toFixed(4)),
    contextStability: Number(contextStability.toFixed(4)),
    supportDensity: Number(supportDensity.toFixed(4)),
    recoveryMargin: Number(recoveryMargin.toFixed(4)),
    readinessTrend: Number(readinessTrend.toFixed(4)),
    blockStructuralConsolidation: stressLoad >= 0.78 && contextStability <= 0.32,
  };

  const namespaceToRecordMap: Array<{ kind: MemoryRecord["kind"]; values: string[] }> = [
    { kind: "procedural", values: globalNamespaces.procedural },
    { kind: "perceptual", values: globalNamespaces.perceptual },
    { kind: "metacognitive", values: globalNamespaces.metacognitive },
    { kind: "prospective", values: globalNamespaces.prospective },
    { kind: "social", values: globalNamespaces.social },
    { kind: "value", values: globalNamespaces.value },
    { kind: "attention", values: globalNamespaces.attention },
  ];

  const nowIso = new Date().toISOString();
  const synthesizedRecords: MemoryRecord[] = [];
  for (const item of namespaceToRecordMap) {
    if (!item.values.length) continue;
    const content = compactLine(item.values.join(" | "), 240);
    synthesizedRecords.push({
      id: makeStableId(`legacy-${item.kind}`, content),
      kind: item.kind,
      content,
      relevance: Number(clamp01(0.42 + (item.values.length * 0.08)).toFixed(4)),
      createdAt: nowIso,
      metadata: { source: "legacy-memory-migration", namespace: item.kind },
    });
  }

  synthesizedRecords.push({
    id: makeStableId("legacy-regulatory", `${stressLoad}-${contextStability}-${supportDensity}`),
    kind: "regulatory",
    content: `stress=${stressLoad.toFixed(2)}; stability=${contextStability.toFixed(2)}; support=${supportDensity.toFixed(2)}; recovery=${recoveryMargin.toFixed(2)}`,
    relevance: Number(clamp01(0.44 + (input.legacySignals.regulatory.score * 0.32)).toFixed(4)),
    createdAt: nowIso,
    metadata: { source: "legacy-memory-migration", namespace: "regulatory" },
  });

  synthesizedRecords.push({
    id: makeStableId("legacy-nodular-attention", `${nodularAttention}-${nodularPriming}`),
    kind: "nodular-attention",
    content: `attention=${nodularAttention.toFixed(2)}; priming=${nodularPriming.toFixed(2)}; weight=${nodularWeight.toFixed(2)}`,
    relevance: Number(clamp01(0.36 + (nodularWeight * 0.4)).toFixed(4)),
    createdAt: nowIso,
    metadata: { source: "legacy-memory-migration", namespace: "nodular" },
  });
  synthesizedRecords.push({
    id: makeStableId("legacy-nodular-state", `${nodularStability}-${input.plasticityScore}`),
    kind: "nodular-state",
    content: `stability=${nodularStability.toFixed(2)}; plasticity=${input.plasticityScore.toFixed(2)}; readiness=${readinessTrend.toFixed(2)}`,
    relevance: Number(clamp01(0.35 + (nodularStability * 0.35)).toFixed(4)),
    createdAt: nowIso,
    metadata: { source: "legacy-memory-migration", namespace: "nodular" },
  });
  synthesizedRecords.push({
    id: makeStableId("legacy-nodular-value", `${nodularValue}-${nodularWeight}`),
    kind: "nodular-value",
    content: `value=${nodularValue.toFixed(2)}; weight=${nodularWeight.toFixed(2)}; attention=${nodularAttention.toFixed(2)}`,
    relevance: Number(clamp01(0.34 + (nodularValue * 0.38)).toFixed(4)),
    createdAt: nowIso,
    metadata: { source: "legacy-memory-migration", namespace: "nodular" },
  });
  synthesizedRecords.push({
    id: makeStableId("legacy-nodular-priming", `${nodularPriming}-${nodularAttention}`),
    kind: "nodular-priming",
    content: `priming=${nodularPriming.toFixed(2)}; attention=${nodularAttention.toFixed(2)}; spikes=${nodularState.spikeHistory.join(",")}`,
    relevance: Number(clamp01(0.34 + (nodularPriming * 0.34)).toFixed(4)),
    createdAt: nowIso,
    metadata: { source: "legacy-memory-migration", namespace: "nodular" },
  });
  synthesizedRecords.push({
    id: makeStableId("legacy-nodular-weight", `${nodularWeight}-${nodularValue}`),
    kind: "nodular-weight",
    content: `weight=${nodularWeight.toFixed(2)}; value=${nodularValue.toFixed(2)}; stability=${nodularStability.toFixed(2)}`,
    relevance: Number(clamp01(0.35 + (nodularWeight * 0.36)).toFixed(4)),
    createdAt: nowIso,
    metadata: { source: "legacy-memory-migration", namespace: "nodular" },
  });

  return {
    globalNamespaces,
    moduleNamespaces,
    nodularState,
    regulatoryState,
    synthesizedRecords,
  };
}
