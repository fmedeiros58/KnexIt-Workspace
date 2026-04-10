import type { MemoryCandidate } from "./memory-loader";

export interface MemoryPriorityWeigherInput {
  candidates: MemoryCandidate[];
  query: string;
}

export interface MemoryPriorityWeigherOutput {
  prioritized: MemoryCandidate[];
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

function sanitizeWeigherText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function tokenize(value: string): string[] {
  return sanitizeWeigherText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((token) => token.length >= 2);
}

function lexicalOverlap(query: string, content: string): number {
  const queryTokens = new Set(tokenize(query));
  const contentTokens = new Set(tokenize(content));

  if (queryTokens.size === 0 || contentTokens.size === 0) return 0;

  const hits = [...queryTokens].filter((token) => contentTokens.has(token)).length;
  return hits / queryTokens.size;
}

function sourceBoostFor(candidate: MemoryCandidate): number {
  if (candidate.source === "snapshot") return 0.08;
  if (candidate.source === "context") return 0.05;
  return 0.03;
}

function normalizeCandidate(candidate: MemoryCandidate): MemoryCandidate {
  const safeContent = sanitizeWeigherText(candidate.content);
  return {
    ...candidate,
    content: safeContent,
    relevance: Number(clamp01(candidate.relevance).toFixed(6)),
    score: Number(clamp01(candidate.score).toFixed(6)),
  };
}

export function memoryPriorityWeigher(
  input: MemoryPriorityWeigherInput,
): MemoryPriorityWeigherOutput {
  const safeQuery = sanitizeWeigherText(input.query);

  const prioritized = (input.candidates || [])
    .map((candidate) => normalizeCandidate(candidate))
    .filter((candidate) => Boolean(candidate.id) && Boolean(candidate.content))
    .map((candidate) => {
      const overlap = lexicalOverlap(safeQuery, candidate.content);
      const sourceBoost = sourceBoostFor(candidate);
      const weighed = clamp01(
        (candidate.score * 0.55) +
          (candidate.relevance * 0.25) +
          (overlap * 0.2) +
          sourceBoost,
      );

      return {
        ...candidate,
        score: Number(weighed.toFixed(6)),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      return (b.content?.length || 0) - (a.content?.length || 0);
    });

  const averageScore = prioritized.length
    ? prioritized.reduce((sum, item) => sum + item.score, 0) / prioritized.length
    : 0;

  return {
    prioritized,
    ok: true,
    component: "memory-priority-weigher",
    score: Number(averageScore.toFixed(4)),
    detail: `prioritized=${prioritized.length}`,
    context: {
      averageScore: Number(averageScore.toFixed(4)),
      queryTokenCount: tokenize(safeQuery).length,
    },
  };
}