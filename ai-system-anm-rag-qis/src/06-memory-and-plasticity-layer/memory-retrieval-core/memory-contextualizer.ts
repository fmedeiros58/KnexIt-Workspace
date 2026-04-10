import type { MemoryCandidate } from "./memory-loader";

export interface MemoryContextualizerInput {
  query: string;
  selected: MemoryCandidate[];
}

export interface MemoryContextualizerOutput {
  contextualized: Array<{ id: string; content: string; relevance: number }>;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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

function sanitizeContextualizedText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function normalizeForMatch(value: string): string {
  return sanitizeContextualizedText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractQueryTokens(value: string): string[] {
  return normalizeForMatch(value)
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((token) => token.length >= 3)
    .slice(0, 8);
}

function compact(value: string, maxChars = 220): string {
  const safe = sanitizeContextualizedText(value);
  if (safe.length <= maxChars) return safe;

  const sliced = safe.slice(0, Math.max(24, maxChars - 1));
  const lastBoundary = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("; "),
    sliced.lastIndexOf(": "),
    sliced.lastIndexOf(", "),
    sliced.lastIndexOf(" "),
  );

  const compacted = lastBoundary >= Math.floor(maxChars * 0.55)
    ? sliced.slice(0, lastBoundary)
    : sliced;

  return `${compacted.trim()}...`;
}

function computeOverlapBoost(query: string, content: string): number {
  const queryTokens = extractQueryTokens(query);
  if (!queryTokens.length) return 0;

  const normalizedContent = normalizeForMatch(content);
  const overlapCount = queryTokens.filter((token) => normalizedContent.includes(token)).length;
  if (!overlapCount) return 0;

  const ratio = overlapCount / queryTokens.length;
  return Math.min(0.12, ratio * 0.12);
}

export function memoryContextualizer(
  input: MemoryContextualizerInput,
): MemoryContextualizerOutput {
  const safeQuery = sanitizeContextualizedText(input.query);
  const contextualized = (input.selected || [])
    .map((item) => {
      const safeContent = sanitizeContextualizedText(item.content);
      if (!safeContent) {
        return null;
      }

      const overlapBoost = computeOverlapBoost(safeQuery, safeContent);
      const relevance = clamp01(Math.max(0.05, item.relevance + overlapBoost));

      return {
        id: item.id,
        content: compact(safeContent),
        relevance: Number(relevance.toFixed(4)),
      };
    })
    .filter((item): item is { id: string; content: string; relevance: number } => Boolean(item));

  const avg = contextualized.length
    ? contextualized.reduce((sum, item) => sum + item.relevance, 0) / contextualized.length
    : 0;

  return {
    contextualized,
    ok: true,
    component: "memory-contextualizer",
    score: Number(avg.toFixed(4)),
    detail: `contextualized=${contextualized.length}`,
    context: {
      queryLength: safeQuery.length,
      queryTokenCount: extractQueryTokens(safeQuery).length,
    },
  };
}