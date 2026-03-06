import type { HybridHit } from "@/core/rag/v2/retrieval/hybrid_v2";

export type GroundingAssessmentInput = {
  question: string;
  sectionTitle: string;
  sectionObjective: string;
  hits: HybridHit[];
  hasDocumentScope: boolean;
};

export type GroundingAssessmentResult = {
  groundedHits: HybridHit[];
  score: number;
  minScore: number;
  isGrounded: boolean;
  usedOnlyFallbackHits: boolean;
  reason: string;
};

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u0900-\u097F\u0980-\u09FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]+/g)
    .filter((token) => token.length >= 2);
}

function overlapRatio(queryTokens: string[], text: string) {
  if (!queryTokens.length) return 0;
  const textTokens = new Set(tokenize(text));
  if (!textTokens.size) return 0;
  let overlap = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(1, queryTokens.length);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreHit(input: GroundingAssessmentInput, hit: HybridHit) {
  const queryTokens = tokenize([input.question, input.sectionTitle, input.sectionObjective].join(" "));
  const overlapText = overlapRatio(queryTokens, hit.text || "");
  const overlapTitle = overlapRatio(queryTokens, hit.title || "");
  const hybrid = Number.isFinite(hit.hybridScore) ? clamp(hit.hybridScore, 0, 1) : 0;
  const fallbackPenalty = hit.rankSource === "scope_fallback" ? -0.12 : 0.04;
  const score = clamp(overlapText * 0.58 + overlapTitle * 0.12 + hybrid * 0.30 + fallbackPenalty, 0, 1);
  return score;
}

export function assessDocumentGrounding(input: GroundingAssessmentInput): GroundingAssessmentResult {
  const hits = Array.isArray(input.hits) ? input.hits : [];
  if (!hits.length) {
    return {
      groundedHits: [],
      score: 0,
      minScore: input.hasDocumentScope ? 0.2 : 0.08,
      isGrounded: false,
      usedOnlyFallbackHits: false,
      reason: "Sem trechos recuperados para ancoragem.",
    };
  }

  const scored = hits
    .map((hit) => ({ hit, score: scoreHit(input, hit) }))
    .sort((a, b) => b.score - a.score);
  const minHitScore = input.hasDocumentScope ? 0.17 : 0.08;
  const grounded = scored.filter((row) => row.score >= minHitScore).map((row) => row.hit);
  const top = scored.slice(0, Math.min(6, scored.length));
  const aggregate = top.length > 0 ? top.reduce((sum, row) => sum + row.score, 0) / top.length : 0;
  const minScore = input.hasDocumentScope ? 0.2 : 0.08;
  const usedOnlyFallbackHits = grounded.length > 0 && grounded.every((row) => row.rankSource === "scope_fallback");
  const hasNonFallback = grounded.some((row) => row.rankSource !== "scope_fallback");
  const groundedByScore = aggregate >= minScore && grounded.length > 0;
  const isGrounded = input.hasDocumentScope ? groundedByScore && hasNonFallback : groundedByScore;

  let reason = "Ancoragem satisfatoria.";
  if (!isGrounded && grounded.length === 0) {
    reason = "Trechos recuperados com baixa aderencia ao pedido.";
  } else if (!isGrounded && usedOnlyFallbackHits) {
    reason = "Somente trechos de fallback de escopo foram encontrados.";
  } else if (!isGrounded) {
    reason = "Aderencia semantica insuficiente ao comando do usuario.";
  }

  return {
    groundedHits: grounded,
    score: Number(aggregate.toFixed(4)),
    minScore,
    isGrounded,
    usedOnlyFallbackHits,
    reason,
  };
}

export function buildGroundingInstruction(hasDocumentScope: boolean) {
  if (!hasDocumentScope) {
    return "Priorize evidencias do contexto recuperado e mantenha aderencia estrita ao pedido.";
  }
  return [
    "Use somente evidencias concretas dos trechos recuperados do documento selecionado.",
    "Nao invente fatos, personagens, eventos, dados ou referencias fora do arquivo.",
    "Se faltar evidencia para algum ponto, declare a limitacao em vez de extrapolar.",
  ].join(" ");
}
