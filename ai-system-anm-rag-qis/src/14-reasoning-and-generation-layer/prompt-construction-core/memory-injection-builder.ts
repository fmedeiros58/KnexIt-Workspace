import type { ProcessingState } from "../../bridges/contracts/processing-state";

const MAX_SELECTED_RECORDS = 3;
const MAX_NAMESPACE_ITEMS = 2;
const MAX_MODULES = 2;
const MAX_MODULE_ENTRIES = 2;
const MAX_RUNTIME_MODULES = 4;
const MAX_TEXT_CHARS = 160;
const MAX_MODULE_TEXT_CHARS = 120;

export function buildMemoryInjection(state: ProcessingState): string {
  const snapshot = state.memorySnapshot;

  const selectedRecords = dedupeNormalized(
    (snapshot.records ?? [])
      .filter((item) => snapshot.selectedRecordIds.includes(item.id))
      .slice(-6)
      .map((item) => sanitizeMemoryText(item.content, MAX_TEXT_CHARS))
      .filter((value): value is string => Boolean(value)),
  ).slice(-MAX_SELECTED_RECORDS);

  const namespaceHints = [
    buildNamespaceLine("procedural", snapshot.globalNamespaces.procedural),
    buildNamespaceLine("semantic", snapshot.globalNamespaces.semantic),
    buildNamespaceLine("metacognitive", snapshot.globalNamespaces.metacognitive),
    buildNamespaceLine("prospective", snapshot.globalNamespaces.prospective),
    buildNamespaceLine("social", snapshot.globalNamespaces.social),
    buildNamespaceLine("value", snapshot.globalNamespaces.value),
    buildNamespaceLine("attention", snapshot.globalNamespaces.attention),
  ].filter((value): value is string => Boolean(value));

  const moduleHints = (snapshot.moduleNamespaces ?? [])
    .slice(0, MAX_MODULES)
    .map((module) => {
      const safeEntries = dedupeNormalized(
        (module.entries ?? [])
          .slice(0, 6)
          .map((entry) => sanitizeMemoryText(entry.content, MAX_MODULE_TEXT_CHARS))
          .filter((value): value is string => Boolean(value)),
      ).slice(0, MAX_MODULE_ENTRIES);

      if (!safeEntries.length) {
        return null;
      }

      return `${module.moduleId}: ${safeEntries.join(" || ")}`;
    })
    .filter((value): value is string => Boolean(value));

  const runtimeModules = dedupeNormalized(
    (snapshot.legacyRuntimeTopModules ?? [])
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean),
  ).slice(0, MAX_RUNTIME_MODULES);

  const nodular = snapshot.nodularState;
  const regulatory = snapshot.regulatoryState;

  const stateLines = [
    buildScalarStateLine("atenção", nodular.attention),
    buildScalarStateLine("priming", nodular.priming),
    buildScalarStateLine("valor", nodular.value),
    buildScalarStateLine("estabilidade nodular", nodular.stability),
    buildScalarStateLine("peso", nodular.weight),
    buildScalarStateLine("carga de estresse", regulatory.stressLoad),
    buildScalarStateLine("estabilidade contextual", regulatory.contextStability),
    buildScalarStateLine("densidade de suporte", regulatory.supportDensity),
    buildScalarStateLine("margem de recuperação", regulatory.recoveryMargin),
    `consolidação estrutural bloqueada: ${regulatory.blockStructuralConsolidation ? "sim" : "não"}`,
  ];

  const sections = [
    "Memória de apoio abaixo. Use apenas como sinal auxiliar para continuidade, personalização e coerência.",
    "Não copie trechos literalmente. Não reproduza histórico de conversa, rótulos de fala, nomes de persona ou estrutura interna do sistema.",
    "<memoria_auxiliar>",
    selectedRecords.length
      ? `memória selecionada: ${selectedRecords.join(" || ")}`
      : "memória selecionada: nenhuma",
    namespaceHints.length
      ? `memória global: ${namespaceHints.join(" /// ")}`
      : "memória global: nenhuma",
    moduleHints.length
      ? `memória modular: ${moduleHints.join(" /// ")}`
      : "memória modular: nenhuma",
    runtimeModules.length
      ? `módulos runtime em evidência: ${runtimeModules.join(", ")}`
      : "módulos runtime em evidência: nenhum",
    `estado regulatório resumido: ${stateLines.join(" | ")}`,
    "</memoria_auxiliar>",
  ];

  return sections.join("\n");
}

function buildNamespaceLine(label: string, values: string[]): string | null {
  const selected = dedupeNormalized(
    (values ?? [])
      .slice(0, 6)
      .map((item) => sanitizeMemoryText(item, MAX_TEXT_CHARS))
      .filter((value): value is string => Boolean(value)),
  ).slice(0, MAX_NAMESPACE_ITEMS);

  if (!selected.length) {
    return null;
  }

  return `${label}: ${selected.join(" || ")}`;
}

function sanitizeMemoryText(raw: string, maxChars: number): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  let text = normalizeWhitespace(raw);

  if (!text) {
    return null;
  }

  if (isLikelyTranscript(text)) {
    return null;
  }

  text = stripRoleMarkers(text);
  text = normalizeWhitespace(text);
  text = text.replace(/\s*\|\s*/g, " — ");

  if (!text || isLowValueMemory(text)) {
    return null;
  }

  return clampText(text, maxChars);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripRoleMarkers(value: string): string {
  return value
    .replace(
      /\b(?:usuário|usuario|user|assistente|assistant|sistema|system|let[ií]cia|humano|ai|modelo)\s*:\s*/gi,
      "",
    )
    .trim();
}

function isLikelyTranscript(value: string): boolean {
  const markers =
    value.match(
      /\b(?:usuário|usuario|user|assistente|assistant|sistema|system|let[ií]cia|humano|ai|modelo)\s*:/gi,
    ) ?? [];

  const hasLineBreaks = /[\r\n]/.test(value);
  return markers.length >= 2 || (markers.length >= 1 && hasLineBreaks);
}

function isLowValueMemory(value: string): boolean {
  const normalized = value.toLowerCase();

  if (
    normalized === "(vazia)" ||
    normalized === "(vazio)" ||
    normalized === "vazia" ||
    normalized === "vazio" ||
    normalized === "none"
  ) {
    return true;
  }

  return value.length < 8;
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars - 1).trimEnd()}…`;
}

function dedupeNormalized(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(value);
  }

  return output;
}

function buildScalarStateLine(label: string, value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${label}=${classifyScalar(safe)}(${safe.toFixed(2)})`;
}

function classifyScalar(value: number): "baixa" | "média" | "alta" {
  if (value < 0.34) {
    return "baixa";
  }

  if (value < 0.67) {
    return "média";
  }

  return "alta";
}