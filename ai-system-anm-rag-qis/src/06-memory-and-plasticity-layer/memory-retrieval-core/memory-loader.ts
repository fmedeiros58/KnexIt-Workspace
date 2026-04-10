import type { MemoryRecord } from "../../shared/types/memory-types";

export interface MemoryCandidate extends MemoryRecord {
  source: "snapshot" | "context" | "turn";
  score: number;
}

export interface MemoryLoaderInput {
  existingRecords: MemoryRecord[];
  activeContext: string[];
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface MemoryLoaderOutput {
  candidates: MemoryCandidate[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

type TurnRole = "user" | "assistant";

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

function sanitizeMemoryCandidateText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function normalizeForId(value: string): string {
  return sanitizeMemoryCandidateText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeId(prefix: string, value: string, index: number): string {
  const normalized = normalizeForId(value) || "empty";
  const base = `${prefix}-${index}-${normalized}`;
  return base.slice(0, 64);
}

function sanitizeRecord(record: MemoryRecord): MemoryRecord | null {
  const safeContent = sanitizeMemoryCandidateText(record.content);
  if (!safeContent) return null;

  return {
    ...record,
    content: safeContent,
    relevance: Number(clamp01(record.relevance).toFixed(4)),
  };
}

function dedupeCandidates(candidates: MemoryCandidate[], limit: number): MemoryCandidate[] {
  const index = new Map<string, MemoryCandidate>();

  for (const candidate of candidates) {
    const existing = index.get(candidate.id);
    if (!existing || candidate.score >= existing.score) {
      index.set(candidate.id, candidate);
    }
  }

  return Array.from(index.values()).slice(-limit);
}

export function memoryLoader(input: MemoryLoaderInput): MemoryLoaderOutput {
  const nowIso = new Date().toISOString();

  const snapshotCandidates: MemoryCandidate[] = [];
  for (const record of input.existingRecords || []) {
    const sanitized = sanitizeRecord(record);
    if (!sanitized) continue;

    snapshotCandidates.push({
      ...sanitized,
      source: "snapshot",
      score: Number(clamp01(sanitized.relevance).toFixed(4)),
    });
  }

  const contextCandidates: MemoryCandidate[] = [];
  const recentContext = (input.activeContext || []).slice(-6);
  for (let index = 0; index < recentContext.length; index += 1) {
    const safeContent = sanitizeMemoryCandidateText(recentContext[index]);
    if (!safeContent) continue;

    contextCandidates.push({
      id: makeId("ctx", safeContent, index),
      kind: "working",
      content: safeContent,
      relevance: 0.58,
      createdAt: nowIso,
      source: "context",
      score: 0.58,
    });
  }

  const turnCandidates: MemoryCandidate[] = [];
  const recentTurns = (input.recentTurns || []).slice(-4);
  for (let index = 0; index < recentTurns.length; index += 1) {
    const turn = recentTurns[index];
    const role: TurnRole = turn.role === "assistant" ? "assistant" : "user";
    const safeContent = sanitizeMemoryCandidateText(turn.content);
    if (!safeContent) continue;

    turnCandidates.push({
      id: makeId(`turn-${role}`, safeContent, index),
      kind: role === "user" ? "episodic" : "short-term",
      content: safeContent,
      relevance: role === "user" ? 0.62 : 0.48,
      createdAt: nowIso,
      source: "turn",
      score: role === "user" ? 0.62 : 0.48,
    });
  }

  const candidates = dedupeCandidates(
    [...snapshotCandidates, ...contextCandidates, ...turnCandidates],
    48,
  );

  const score = Math.min(1, 0.3 + (candidates.length * 0.05));

  return {
    candidates,
    ok: true,
    component: "memory-loader",
    score: Number(score.toFixed(4)),
    detail: `candidates=${candidates.length}`,
    context: {
      snapshot: snapshotCandidates.length,
      context: contextCandidates.length,
      turns: turnCandidates.length,
      dedupedTotal: candidates.length,
    },
  };
}