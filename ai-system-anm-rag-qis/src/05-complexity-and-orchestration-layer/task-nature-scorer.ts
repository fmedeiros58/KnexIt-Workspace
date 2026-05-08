/**
 * @file task-nature-scorer.ts
 * @description Pontua hipoteses de natureza cognitiva da tarefa por sinais textuais auditaveis.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Identificar o regime cognitivo adequado sem confundir isso com intent conversacional.
 * @inputs Texto normalizado, intent conversacional, dominio e sinais de sessao.
 * @outputs Hipoteses TaskNatureHypothesis ordenadas por score.
 * @dependsOn bridges/contracts/cognitive-task-type, bridges/contracts/task-nature-state.
 * @usedBy task-nature-classifier e seletores de perfil.
 * @invariants Pontuacao deve ser generica por classe de tarefa e nao hardcoded para um unico puzzle.
 * @notes Scores sao normalizados para comparacao local no turno.
 */
import type { CognitiveTaskType } from "../bridges/contracts/cognitive-task-type";
import type { TaskNatureHypothesis } from "../bridges/contracts/task-nature-state";

export interface TaskNatureScorerInput {
  normalizedMessage: string;
  conversationalIntent?: string;
  domain?: string;
  hasRetrievalSignal?: boolean;
  hasGreetingSignal?: boolean;
  hasRecencySignal?: boolean;
}

interface ScoreRule {
  taskType: CognitiveTaskType;
  weight: number;
  patterns: RegExp[];
  rationale: string;
}

const RULES: ScoreRule[] = [
  {
    taskType: "greeting_light",
    weight: 0.78,
    patterns: [/\b(oi|ola|olá|bom dia|boa tarde|boa noite|hello|hi)\b/i],
    rationale: "saudacao curta detectada",
  },
  {
    taskType: "conversational_light",
    weight: 0.36,
    patterns: [/\b(como vai|tudo bem|me conta|conversa|bate papo)\b/i],
    rationale: "continuidade conversacional leve",
  },
  {
    taskType: "pedagogical_explanation",
    weight: 0.62,
    patterns: [/\b(explique|ensine|didaticamente|passo a passo|por que|como funciona)\b/i],
    rationale: "pedido de explicacao progressiva",
  },
  {
    taskType: "technical_analysis",
    weight: 0.62,
    patterns: [/\b(analise|arquitetura|sistema|codigo|typescript|pipeline|implementa[cç][aã]o|reposit[oó]rio)\b/i],
    rationale: "pedido tecnico ou arquitetural",
  },
  {
    taskType: "dialectical_counterargument",
    weight: 0.7,
    patterns: [/\b(contra-?argument|discorde|conteste|refute|critique|oponha|tese|premissa)\b/i],
    rationale: "pedido de contraponto ou teste de tese",
  },
  {
    taskType: "closed_constraint_deduction",
    weight: 0.78,
    patterns: [
      /\b(apenas|somente|s[oó]|unica|[úu]nica|restri[cç][aã]o|todas?.*errad|sem olhar|pode tirar|como descobrir)\b/i,
      /\b(caixas?|etiquetas?|frutas?|premissas?|enunciado|deduz|l[oó]gica)\b/i,
    ],
    rationale: "problema fechado com restricoes explicitas",
  },
  {
    taskType: "short_deterministic_reasoning",
    weight: 0.56,
    patterns: [/\b(calcule|qual [eé]|quanto [eé]|responda direto|curto|sem explicar)\b/i],
    rationale: "raciocinio curto com resposta deterministica",
  },
  {
    taskType: "procedural_instruction",
    weight: 0.58,
    patterns: [/\b(como fa[cç]o|instru[cç][oõ]es|procedimento|passos|guia|configure|instale)\b/i],
    rationale: "pedido de procedimento executavel",
  },
  {
    taskType: "retrieval_grounded_analysis",
    weight: 0.7,
    patterns: [/\b(fontes|cita[cç][oõ]es|pesquise|busque|documenta[cç][aã]o|latest|recente|verifique)\b/i],
    rationale: "necessidade de grounding externo ou evidencial",
  },
  {
    taskType: "debug_and_correction",
    weight: 0.68,
    patterns: [/\b(debug|corrig|erro|falha|bug|quebra|cortad|truncad|unavailable)\b/i],
    rationale: "pedido de depuracao ou correcao",
  },
  {
    taskType: "academic_normalization",
    weight: 0.6,
    patterns: [/\b(abnt|apa|academico|acad[eê]mico|normaliza|citacao|cita[cç][aã]o|refer[eê]ncias)\b/i],
    rationale: "pedido de normalizacao academica",
  },
  {
    taskType: "reflective_comparison",
    weight: 0.58,
    patterns: [/\b(compare|compara[cç][aã]o|semelhan[cç]as|diferen[cç]as|trade-?off)\b/i],
    rationale: "pedido comparativo reflexivo",
  },
  {
    taskType: "decision_between_alternatives",
    weight: 0.64,
    patterns: [/\b(decida|escolha|melhor op[cç][aã]o|entre .+ e .+|alternativas?)\b/i],
    rationale: "decisao entre alternativas",
  },
  {
    taskType: "open_exploration",
    weight: 0.5,
    patterns: [/\b(explore|brainstorm|possibilidades|ideias|hip[oó]teses|investigue)\b/i],
    rationale: "exploracao aberta",
  },
  {
    taskType: "structured_synthesis",
    weight: 0.54,
    patterns: [/\b(sintetize|resuma|estruture|consolide|organize|sum[aá]rio|relat[oó]rio)\b/i],
    rationale: "sintese estruturada",
  },
];

function normalizeScore(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

function matchRule(rule: ScoreRule, text: string): { score: number; signals: string[] } {
  const signals = rule.patterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);
  if (!signals.length) return { score: 0, signals };
  const densityBonus = Math.min(0.2, (signals.length - 1) * 0.08);
  return {
    score: normalizeScore(rule.weight + densityBonus),
    signals,
  };
}

export function scoreTaskNatureHypotheses(input: TaskNatureScorerInput): TaskNatureHypothesis[] {
  const text = `${input.normalizedMessage || ""}`.toLowerCase();
  const hypotheses = RULES.map((rule) => {
    const match = matchRule(rule, text);
    let score = match.score;
    const signals = [...match.signals];

    if (rule.taskType === "greeting_light" && input.hasGreetingSignal) {
      score = Math.max(score, 0.82);
      signals.push("snapshot:greeting");
    }
    if (rule.taskType === "retrieval_grounded_analysis" && (input.hasRetrievalSignal || input.hasRecencySignal)) {
      score = Math.max(score, 0.74);
      signals.push("snapshot:retrieval_or_recency");
    }
    if (rule.taskType === "technical_analysis" && /technical|analysis/i.test(`${input.conversationalIntent || ""}`)) {
      score = Math.max(score, 0.58);
      signals.push("intent:technical_or_analysis");
    }
    if (rule.taskType === "debug_and_correction" && /erro|falha|debug|correction/i.test(`${input.conversationalIntent || ""}`)) {
      score = Math.max(score, 0.66);
      signals.push("intent:debug");
    }

    return {
      taskType: rule.taskType,
      score: normalizeScore(score),
      matchedSignals: signals,
      rationale: rule.rationale,
    };
  });

  const nonZero = hypotheses.filter((item) => item.score > 0);
  if (!nonZero.length) {
    return [
      {
        taskType: text.length <= 120 ? "conversational_light" : "open_exploration",
        score: 0.34,
        matchedSignals: ["fallback:low_signal"],
        rationale: "sem sinal forte; fallback conservador por tamanho do turno",
      },
    ];
  }

  return nonZero.sort((left, right) => right.score - left.score);
}
