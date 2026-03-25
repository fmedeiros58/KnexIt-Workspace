import type { MemoryKind, MemoryRecord } from "../../shared/types/memory-types";
import { analyzeMemoryText, clamp01, countMemoryMatches, repeatedTokenRatio } from "../memory-signal-utils";

export type LegacyRuntimeModuleName =
  | "checkpoint_manager"
  | "forgetting_engine"
  | "global_attention"
  | "global_episodic"
  | "global_memory"
  | "global_metacognitive"
  | "global_perceptual"
  | "global_procedural"
  | "global_prospective"
  | "global_semantic"
  | "global_social"
  | "global_value"
  | "memory_manager"
  | "memory_policies"
  | "modular_attention"
  | "modular_episodic"
  | "modular_metacognitive"
  | "modular_perceptual"
  | "modular_procedural"
  | "modular_semantic"
  | "modular_value"
  | "module_memory"
  | "nodular_attention"
  | "nodular_plasticity_state"
  | "nodular_priming"
  | "nodular_spike_history"
  | "nodular_state"
  | "nodular_value"
  | "nodular_weights"
  | "nodule_memory"
  | "persistence_bridge"
  | "ram_cortex"
  | "regulatory_state"
  | "working_memory";

const LEGACY_RUNTIME_MODULES: LegacyRuntimeModuleName[] = [
  "checkpoint_manager",
  "forgetting_engine",
  "global_attention",
  "global_episodic",
  "global_memory",
  "global_metacognitive",
  "global_perceptual",
  "global_procedural",
  "global_prospective",
  "global_semantic",
  "global_social",
  "global_value",
  "memory_manager",
  "memory_policies",
  "modular_attention",
  "modular_episodic",
  "modular_metacognitive",
  "modular_perceptual",
  "modular_procedural",
  "modular_semantic",
  "modular_value",
  "module_memory",
  "nodular_attention",
  "nodular_plasticity_state",
  "nodular_priming",
  "nodular_spike_history",
  "nodular_state",
  "nodular_value",
  "nodular_weights",
  "nodule_memory",
  "persistence_bridge",
  "ram_cortex",
  "regulatory_state",
  "working_memory",
];

interface RuntimeSpec {
  pattern: RegExp;
  base: number;
  cueWeight: number;
  tokenWeight: number;
  punctuationWeight: number;
}

const PROCESS_SPEC: RuntimeSpec = {
  pattern: /\b(memory|context|state|cortex|orchestr|trace|bridge|policy|checkpoint)\w*/g,
  base: 0.2,
  cueWeight: 0.48,
  tokenWeight: 0.18,
  punctuationWeight: 0.08,
};

const ATTENTION_SPEC: RuntimeSpec = {
  pattern: /\b(foco|aten|prioriz|urgent|important|critical)\w*/g,
  base: 0.18,
  cueWeight: 0.56,
  tokenWeight: 0.14,
  punctuationWeight: 0.08,
};

const EPISODIC_SPEC: RuntimeSpec = {
  pattern: /\b(antes|depois|ontem|hoje|historico|last|previous|turno)\w*/g,
  base: 0.18,
  cueWeight: 0.52,
  tokenWeight: 0.14,
  punctuationWeight: 0.08,
};

const SEMANTIC_SPEC: RuntimeSpec = {
  pattern: /\b(conceit|defin|fato|evid|meaning|definition|semant)\w*/g,
  base: 0.2,
  cueWeight: 0.52,
  tokenWeight: 0.14,
  punctuationWeight: 0.06,
};

const PROCEDURAL_SPEC: RuntimeSpec = {
  pattern: /\b(passo|etapa|proced|fluxo|script|workflow|roteiro)\w*/g,
  base: 0.2,
  cueWeight: 0.54,
  tokenWeight: 0.14,
  punctuationWeight: 0.08,
};

const PERCEPTUAL_SPEC: RuntimeSpec = {
  pattern: /\b(imagem|visual|audio|tom|layout|ux|ui|percep)\w*/g,
  base: 0.16,
  cueWeight: 0.52,
  tokenWeight: 0.16,
  punctuationWeight: 0.08,
};

const METACOGNITIVE_SPEC: RuntimeSpec = {
  pattern: /\b(assum|premissa|hipot|incerteza|limita|tradeoff|critic)\w*/g,
  base: 0.2,
  cueWeight: 0.56,
  tokenWeight: 0.14,
  punctuationWeight: 0.08,
};

const PROSPECTIVE_SPEC: RuntimeSpec = {
  pattern: /\b(proximo|futuro|planej|roadmap|next|later|depois)\w*/g,
  base: 0.18,
  cueWeight: 0.54,
  tokenWeight: 0.16,
  punctuationWeight: 0.08,
};

const SOCIAL_SPEC: RuntimeSpec = {
  pattern: /\b(usuario|cliente|equipe|time|stakeholder|pessoa|social)\w*/g,
  base: 0.18,
  cueWeight: 0.52,
  tokenWeight: 0.16,
  punctuationWeight: 0.08,
};

const VALUE_SPEC: RuntimeSpec = {
  pattern: /\b(valor|impacto|beneficio|custo|risco|prioridade|tradeoff)\w*/g,
  base: 0.2,
  cueWeight: 0.54,
  tokenWeight: 0.14,
  punctuationWeight: 0.08,
};

const REGULATORY_SPEC: RuntimeSpec = {
  pattern: /\b(conflito|erro|falha|stress|pressao|coerencia|estavel|risco)\w*/g,
  base: 0.2,
  cueWeight: 0.56,
  tokenWeight: 0.12,
  punctuationWeight: 0.08,
};

const WORKING_SPEC: RuntimeSpec = {
  pattern: /\b(agora|neste|current|request|tarefa|execute|implemente)\w*/g,
  base: 0.22,
  cueWeight: 0.56,
  tokenWeight: 0.14,
  punctuationWeight: 0.08,
};

function specForModule(moduleName: LegacyRuntimeModuleName): RuntimeSpec {
  if (moduleName.includes("attention")) return ATTENTION_SPEC;
  if (moduleName.includes("episodic")) return EPISODIC_SPEC;
  if (moduleName.includes("semantic")) return SEMANTIC_SPEC;
  if (moduleName.includes("procedural")) return PROCEDURAL_SPEC;
  if (moduleName.includes("perceptual")) return PERCEPTUAL_SPEC;
  if (moduleName.includes("metacognitive")) return METACOGNITIVE_SPEC;
  if (moduleName.includes("prospective")) return PROSPECTIVE_SPEC;
  if (moduleName.includes("social")) return SOCIAL_SPEC;
  if (moduleName.includes("value")) return VALUE_SPEC;
  if (moduleName.includes("regulatory")) return REGULATORY_SPEC;
  if (moduleName.includes("working")) return WORKING_SPEC;
  if (moduleName.includes("nodular")) return ATTENTION_SPEC;
  return PROCESS_SPEC;
}

function kindForModule(moduleName: LegacyRuntimeModuleName): MemoryKind {
  if (moduleName.includes("attention")) return moduleName.includes("nodular") ? "nodular-attention" : "attention";
  if (moduleName.includes("episodic")) return "episodic";
  if (moduleName.includes("semantic")) return "semantic";
  if (moduleName.includes("procedural")) return "procedural";
  if (moduleName.includes("perceptual")) return "perceptual";
  if (moduleName.includes("metacognitive")) return "metacognitive";
  if (moduleName.includes("prospective")) return "prospective";
  if (moduleName.includes("social")) return "social";
  if (moduleName.includes("value")) return moduleName.includes("nodular") ? "nodular-value" : "value";
  if (moduleName.includes("regulatory")) return "regulatory";
  if (moduleName.includes("working")) return "working";
  if (moduleName === "nodular_priming") return "nodular-priming";
  if (moduleName === "nodular_weights") return "nodular-weight";
  if (moduleName === "nodular_state" || moduleName === "nodular_plasticity_state" || moduleName === "nodular_spike_history") {
    return "nodular-state";
  }
  if (moduleName === "forgetting_engine") return "short-term";
  if (moduleName === "checkpoint_manager" || moduleName === "persistence_bridge") return "long-term";
  return "process";
}

function stableId(moduleName: string, text: string) {
  const compact = `${moduleName}-${text}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 56);
  return `${compact}-${Math.abs(text.length % 97)}`;
}

export interface LegacyMemoryRuntimeInput {
  text?: string;
  constraints?: string[];
  nodularAttention?: number;
  nodularValue?: number;
  nodularPriming?: number;
  regulatoryStress?: number;
  regulatoryStability?: number;
}

export interface LegacyMemoryRuntimeOutput {
  moduleScores: Record<LegacyRuntimeModuleName, number>;
  topModules: LegacyRuntimeModuleName[];
  synthesizedRecords: MemoryRecord[];
  runtimeSignal: number;
}

export function runLegacyMemoryRuntime(input: LegacyMemoryRuntimeInput = {}): LegacyMemoryRuntimeOutput {
  const analysis = analyzeMemoryText(input.text);
  const repeatedRatio = repeatedTokenRatio(analysis.tokens);
  const stress = clamp01(input.regulatoryStress || 0);
  const stability = clamp01(input.regulatoryStability || 0.5);
  const nodularAttention = clamp01(input.nodularAttention || 0);
  const nodularValue = clamp01(input.nodularValue || 0);
  const nodularPriming = clamp01(input.nodularPriming || 0);
  const strictConstraintBoost = (input.constraints || []).some((item) => /strict|critical|risk|conflict/i.test(item)) ? 0.08 : 0;

  const moduleScores = LEGACY_RUNTIME_MODULES.reduce<Record<LegacyRuntimeModuleName, number>>((acc, moduleName) => {
    const spec = specForModule(moduleName);
    const cues = countMemoryMatches(analysis.normalized, spec.pattern);
    const nodularBoost = (
      (moduleName.includes("attention") ? nodularAttention : 0) +
      (moduleName.includes("value") ? nodularValue : 0) +
      (moduleName.includes("priming") ? nodularPriming : 0)
    ) * 0.22;
    const stressImpact = moduleName.includes("regulatory") ? (stress * 0.22) : (stress * -0.08);
    const stabilityImpact = moduleName.includes("regulatory") ? (stability * -0.1) : (stability * 0.08);
    const repetitionImpact = repeatedRatio * (moduleName.includes("episodic") || moduleName.includes("working") ? 0.22 : 0.08);

    const score = clamp01(
      spec.base +
      (Math.min(1, cues / 4) * spec.cueWeight) +
      (Math.min(1, analysis.tokenCount / 44) * spec.tokenWeight) +
      (Math.min(1, analysis.punctuationCount / 8) * spec.punctuationWeight) +
      nodularBoost +
      stressImpact +
      stabilityImpact +
      repetitionImpact +
      strictConstraintBoost,
    );
    acc[moduleName] = Number(score.toFixed(4));
    return acc;
  }, {} as Record<LegacyRuntimeModuleName, number>);

  const topModules = Object.entries(moduleScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name as LegacyRuntimeModuleName);

  const runtimeSignal = topModules.length
    ? Number(
      (
        topModules.reduce((sum, name) => sum + (moduleScores[name] || 0), 0) / topModules.length
      ).toFixed(4),
    )
    : 0;

  const nowIso = new Date().toISOString();
  const synthesizedRecords: MemoryRecord[] = topModules.map((moduleName, index) => {
    const score = moduleScores[moduleName] || 0;
    const kind = kindForModule(moduleName);
    const content = `legacy-module=${moduleName}; runtimeScore=${score.toFixed(2)}; stress=${stress.toFixed(2)}; stability=${stability.toFixed(2)}`;
    return {
      id: stableId(`legacy-runtime-${index + 1}`, moduleName),
      kind,
      content,
      relevance: Number(clamp01(0.36 + (score * 0.5)).toFixed(4)),
      createdAt: nowIso,
      metadata: {
        source: "legacy-runtime-registry",
        moduleName,
        runtimeScore: score,
      },
    };
  });

  return {
    moduleScores,
    topModules,
    synthesizedRecords,
    runtimeSignal,
  };
}
