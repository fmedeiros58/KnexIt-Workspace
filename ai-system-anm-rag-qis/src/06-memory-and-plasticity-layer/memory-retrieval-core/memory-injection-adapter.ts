import type { MemoryRecord } from "../../shared/types/memory-types";

export interface MemoryInjectionAdapterInput {
  existingRecords: MemoryRecord[];
  contextualized: Array<{ id: string; content: string; relevance: number }>;
}

export interface MemoryInjectionAdapterOutput {
  records: MemoryRecord[];
  selectedIds: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function clamp01(value: number): number {
  return Math.max(0.05, Math.min(1, value));
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

function sanitizeMemoryContent(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeMemoryRecord(record: MemoryRecord): MemoryRecord | null {
  const safeContent = sanitizeMemoryContent(record.content);
  if (!safeContent) return null;

  return {
    ...record,
    content: safeContent,
    relevance: Number(clamp01(record.relevance).toFixed(4)),
  };
}

export function memoryInjectionAdapter(
  input: MemoryInjectionAdapterInput,
): MemoryInjectionAdapterOutput {
  const nowIso = new Date().toISOString();

  const sanitizedExistingRecords = (input.existingRecords || [])
    .map((record) => sanitizeMemoryRecord(record))
    .filter((record): record is MemoryRecord => Boolean(record));

  const contextualizedRecords: MemoryRecord[] = (input.contextualized || [])
    .map((item) => {
      const safeContent = sanitizeMemoryContent(item.content);
      if (!safeContent) return null;

      const existing = sanitizedExistingRecords.find((record) => record.id === item.id);

      return {
        id: item.id,
        kind: existing?.kind || "working",
        content: safeContent,
        relevance: Number(clamp01(item.relevance).toFixed(4)),
        createdAt: existing?.createdAt || nowIso,
      } satisfies MemoryRecord;
    })
    .filter((record): record is MemoryRecord => Boolean(record));

  const mergedIndex = new Map<string, MemoryRecord>();

  for (const record of sanitizedExistingRecords) {
    mergedIndex.set(record.id, record);
  }

  for (const record of contextualizedRecords) {
    mergedIndex.set(record.id, record);
  }

  const merged = Array.from(mergedIndex.values()).slice(-24);

  const selectedIds = [...new Set(contextualizedRecords.map((item) => item.id))];
  const avgRelevance = contextualizedRecords.length
    ? contextualizedRecords.reduce((sum, item) => sum + item.relevance, 0) / contextualizedRecords.length
    : 0;

  return {
    records: merged,
    selectedIds,
    ok: true,
    component: "memory-injection-adapter",
    score: Number(avgRelevance.toFixed(4)),
    detail: `merged=${merged.length}; contextualized=${contextualizedRecords.length}`,
    context: {
      selectedIds,
      existingRecords: sanitizedExistingRecords.length,
      contextualizedRecords: contextualizedRecords.length,
      mergedCount: merged.length,
    },
  };
}