import type { ProcessingState } from "../../bridges/contracts/processing-state";

function compact(value: string, maxChars = 180) {
  const safe = value.replace(/\s+/g, " ").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

function namespaceLine(label: string, values: string[]) {
  const selected = values.slice(0, 2).map((item) => compact(item)).filter(Boolean);
  if (!selected.length) return "";
  return `${label}: ${selected.join(" | ")}`;
}

export function buildMemoryInjection(state: ProcessingState): string {
  const selected = state.memorySnapshot.records
    .filter((item) => state.memorySnapshot.selectedRecordIds.includes(item.id))
    .slice(-5)
    .map((item) => compact(item.content));

  const namespaceHints = [
    namespaceLine("procedural", state.memorySnapshot.globalNamespaces.procedural),
    namespaceLine("semantic", state.memorySnapshot.globalNamespaces.semantic),
    namespaceLine("metacognitive", state.memorySnapshot.globalNamespaces.metacognitive),
    namespaceLine("prospective", state.memorySnapshot.globalNamespaces.prospective),
    namespaceLine("social", state.memorySnapshot.globalNamespaces.social),
    namespaceLine("value", state.memorySnapshot.globalNamespaces.value),
    namespaceLine("attention", state.memorySnapshot.globalNamespaces.attention),
  ].filter(Boolean);

  const moduleHints = state.memorySnapshot.moduleNamespaces
    .slice(0, 2)
    .map((module) => {
      const entries = module.entries.slice(0, 2).map((entry) => compact(entry.content, 120));
      return entries.length ? `${module.moduleId}: ${entries.join(" | ")}` : "";
    })
    .filter(Boolean);

  const nodular = state.memorySnapshot.nodularState;
  const regulatory = state.memorySnapshot.regulatoryState;
  const nodularLine =
    `nodular: att=${nodular.attention.toFixed(2)} prim=${nodular.priming.toFixed(2)} ` +
    `val=${nodular.value.toFixed(2)} stable=${nodular.stability.toFixed(2)} weight=${nodular.weight.toFixed(2)}`;
  const regulatoryLine =
    `regulatory: stress=${regulatory.stressLoad.toFixed(2)} stability=${regulatory.contextStability.toFixed(2)} ` +
    `support=${regulatory.supportDensity.toFixed(2)} recovery=${regulatory.recoveryMargin.toFixed(2)} ` +
    `block=${regulatory.blockStructuralConsolidation ? "yes" : "no"}`;

  const lines = [
    selected.length ? `Memoria selecionada: ${selected.join(" | ")}` : "Memoria selecionada: (vazia)",
    namespaceHints.length ? `Memoria global: ${namespaceHints.join(" || ")}` : "Memoria global: (vazia)",
    moduleHints.length ? `Memoria modular: ${moduleHints.join(" || ")}` : "Memoria modular: (vazia)",
    state.memorySnapshot.legacyRuntimeTopModules.length
      ? `Memoria runtime ativa: ${state.memorySnapshot.legacyRuntimeTopModules.slice(0, 6).join(", ")}`
      : "Memoria runtime ativa: (vazia)",
    nodularLine,
    regulatoryLine,
  ];
  return lines.join("\n");
}
