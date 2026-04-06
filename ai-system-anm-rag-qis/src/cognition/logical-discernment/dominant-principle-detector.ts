import type { DominantPrinciple, DominantPrincipleDetection, LogicalDiscernmentInput } from "./logical-discernment-types";
import { clamp01, normalizeLogicalText } from "./logical-discernment-utils";

type PrincipleScore = Record<DominantPrinciple, number>;

const PRINCIPLE_PATTERNS: Record<Exclude<DominantPrinciple, "mixed" | "unknown">, RegExp[]> = {
  economy: [
    /\b(economia|economico|economica|gastar menos|menor custo|barato|mais barato|reduzir custo|custo marginal|custo adicional)\b/g,
    /\b(vale mais a pena|melhor custo beneficio)\b/g,
  ],
  time: [
    /\b(mais rapido|rapido|rapida|ganhar tempo|menos tempo|agilidade|urgente|ordem|sequencia)\b/g,
    /\b(em \d+\s*(min|mins|minutos|h|horas))\b/g,
  ],
  safety: [
    /\b(seguranca|mais seguro|risco|evitar risco|perigo|protecao|protecao)\b/g,
    /\b(noite|tarde da noite|area perigosa|sozinho|sozinha)\b/g,
  ],
  accuracy: [
    /\b(precisao|preciso|exato|exata|acuracia|acerto|factual|correto|correta)\b/g,
    /\b(sem erro|rigor|verificavel)\b/g,
  ],
  comfort: [
    /\b(conforto|confortavel|comodidade|comodo|pratico para mim|mais comodo)\b/g,
  ],
  risk_reduction: [
    /\b(reduzir risco|mitigar risco|minimizar risco|menor exposicao)\b/g,
  ],
  effort_reduction: [
    /\b(menos esforco|esforco minimo|evitar cansaco|sem carregar peso|menos trabalho|simplificar)\b/g,
  ],
};

function buildZeroScores(): PrincipleScore {
  return {
    economy: 0,
    time: 0,
    safety: 0,
    accuracy: 0,
    comfort: 0,
    risk_reduction: 0,
    effort_reduction: 0,
    mixed: 0,
    unknown: 0,
  };
}

function scoreByPatterns(normalized: string): PrincipleScore {
  const scores = buildZeroScores();
  (Object.keys(PRINCIPLE_PATTERNS) as Array<Exclude<DominantPrinciple, "mixed" | "unknown">>).forEach((principle) => {
    const hits = PRINCIPLE_PATTERNS[principle].reduce((acc, pattern) => {
      const matches = normalized.match(pattern);
      return acc + (matches?.length || 0);
    }, 0);
    scores[principle] += hits;
  });
  return scores;
}

function applyPragmaticBias(scores: PrincipleScore, input: LogicalDiscernmentInput) {
  const intent = normalizeLogicalText(input.pragmaticIntent || "");
  const speechAct = normalizeLogicalText(input.speechAct || "");
  const directiveForce = input.directiveForce || 0;
  if (/\boptimiz|escolher|decidir|comparar|avaliar\b/.test(intent)) {
    scores.accuracy += 0.3;
    scores.time += 0.2;
  }
  if (/\brequest|directive|pedido\b/.test(speechAct) && directiveForce >= 0.55) {
    scores.time += 0.2;
    scores.economy += 0.2;
  }
}

function detectExplicitPrincipleHint(normalized: string): DominantPrinciple | null {
  if (/\bprincipio\b[^\n]{0,24}\beconom/.test(normalized)) return "economy";
  if (/\bprincipio\b[^\n]{0,24}\btempo/.test(normalized)) return "time";
  if (/\bprincipio\b[^\n]{0,24}\bsegur/.test(normalized)) return "safety";
  if (/\bprincipio\b[^\n]{0,24}\bprecis/.test(normalized)) return "accuracy";
  if (/\bprincipio\b[^\n]{0,24}\bconfort/.test(normalized)) return "comfort";
  if (/\bprincipio\b[^\n]{0,24}\brisco/.test(normalized)) return "risk_reduction";
  if (/\bprincipio\b[^\n]{0,24}\besfor/.test(normalized)) return "effort_reduction";
  return null;
}

export function detectDominantPrinciple(input: LogicalDiscernmentInput): DominantPrincipleDetection {
  const normalized = normalizeLogicalText(input.normalizedMessage || input.message);
  if (!normalized) {
    return {
      dominantPrinciple: "unknown",
      confidence: 0,
      evidence: ["empty_prompt"],
    };
  }

  const explicitHint = detectExplicitPrincipleHint(normalized);
  const scores = scoreByPatterns(normalized);
  applyPragmaticBias(scores, input);

  if (explicitHint) {
    scores[explicitHint] += 2.5;
  }

  const ranked = (Object.entries(scores) as Array<[DominantPrinciple, number]>)
    .filter(([key]) => key !== "mixed" && key !== "unknown")
    .sort((a, b) => b[1] - a[1]);

  const [topPrinciple, topScore] = ranked[0] || ["unknown", 0];
  const secondScore = ranked[1]?.[1] || 0;

  if (topScore <= 0) {
    return {
      dominantPrinciple: "unknown",
      confidence: 0.18,
      evidence: ["no_principle_signal"],
    };
  }

  const nearTie = topScore > 0 && Math.abs(topScore - secondScore) <= 0.55;
  const dominantPrinciple: DominantPrinciple = nearTie ? "mixed" : (topPrinciple as DominantPrinciple);
  const confidenceBase = topScore / Math.max(1, topScore + secondScore);
  const confidence = clamp01(nearTie ? confidenceBase * 0.72 : confidenceBase);

  return {
    dominantPrinciple,
    confidence,
    evidence: [
      `top=${topPrinciple}:${topScore.toFixed(2)}`,
      `second=${(ranked[1]?.[0] || "none")}:${secondScore.toFixed(2)}`,
      ...(explicitHint ? [`explicit_hint=${explicitHint}`] : []),
      ...(nearTie ? ["near_tie_detected"] : []),
    ],
  };
}

