import { analyzeMemoryText, clamp01, countMemoryMatches, repeatedTokenRatio } from "../memory-signal-utils";

export interface LegacyMemorySignalOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export interface LegacyMemorySignalsInput {
  text?: string;
  constraints?: string[];
}

interface SignalPattern {
  component: string;
  cuePattern: RegExp;
  base: number;
  cueWeight: number;
}

const LEGACY_MEMORY_PATTERNS: SignalPattern[] = [
  {
    component: "procedural-memory",
    cuePattern: /\b(passo|etapa|procedimento|workflow|script|como|how to|runbook|roteiro)\b/g,
    base: 0.2,
    cueWeight: 0.48,
  },
  {
    component: "perceptual-memory",
    cuePattern: /\b(imagem|visual|layout|audio|som|tom|captura|observou|vi|percebi|ux|ui)\b/g,
    base: 0.16,
    cueWeight: 0.46,
  },
  {
    component: "metacognitive-memory",
    cuePattern: /\b(assum|hipot|reflet|certeza|incerteza|limita|tradeoff|premissa|critic)\w*/g,
    base: 0.18,
    cueWeight: 0.5,
  },
  {
    component: "prospective-memory",
    cuePattern: /\b(proximo|depois|futuro|planej|roadmap|amanha|seguinte|will|next)\w*/g,
    base: 0.18,
    cueWeight: 0.46,
  },
  {
    component: "social-memory",
    cuePattern: /\b(usuario|cliente|equipe|time|stakeholder|colabor|pessoa|perfil|persona)\w*/g,
    base: 0.16,
    cueWeight: 0.46,
  },
  {
    component: "value-memory",
    cuePattern: /\b(valor|impacto|beneficio|custo|prioridade|risco|ganho|retorno)\w*/g,
    base: 0.2,
    cueWeight: 0.5,
  },
  {
    component: "attention-memory",
    cuePattern: /\b(foco|aten|importante|urgente|critico|prioriz|essencial)\w*/g,
    base: 0.2,
    cueWeight: 0.52,
  },
];

function computeSignal(
  pattern: SignalPattern,
  normalizedText: string,
  tokenCount: number,
  punctuationCount: number,
): LegacyMemorySignalOutput {
  const cues = countMemoryMatches(normalizedText, pattern.cuePattern);
  const score = clamp01(
    pattern.base +
    (Math.min(1, cues / 4) * pattern.cueWeight) +
    (Math.min(1, tokenCount / 40) * 0.16) +
    (Math.min(1, punctuationCount / 8) * 0.08),
  );
  return {
    ok: true,
    component: pattern.component,
    score: Number(score.toFixed(4)),
    detail: `cues=${cues}; tokenCount=${tokenCount}; punctuation=${punctuationCount}`,
    context: {
      cues,
      tokenCount,
      punctuationCount,
    },
  };
}

function computeNodularSignals(
  normalizedText: string,
  tokenCount: number,
  punctuationCount: number,
  repeatedRatio: number,
) {
  const attentionCues = countMemoryMatches(normalizedText, /\b(foco|aten|prioriz|urgente|importante)\w*/g);
  const valueCues = countMemoryMatches(normalizedText, /\b(valor|impacto|beneficio|custo|risco)\w*/g);
  const primingCues = countMemoryMatches(normalizedText, /\b(lembr|record|continue|retom|novamente)\w*/g);

  const nodularAttention = clamp01(0.18 + Math.min(1, attentionCues / 4) * 0.62 + Math.min(1, punctuationCount / 8) * 0.2);
  const nodularValue = clamp01(0.18 + Math.min(1, valueCues / 4) * 0.62 + repeatedRatio * 0.2);
  const nodularPriming = clamp01(0.16 + Math.min(1, primingCues / 4) * 0.58 + repeatedRatio * 0.26);
  const nodularState = clamp01(0.22 + Math.min(1, tokenCount / 42) * 0.52 + repeatedRatio * 0.26);
  const nodularWeight = clamp01((nodularAttention * 0.28) + (nodularValue * 0.24) + (nodularPriming * 0.24) + (nodularState * 0.24));

  const build = (component: string, score: number, cues: number): LegacyMemorySignalOutput => ({
    ok: true,
    component,
    score: Number(score.toFixed(4)),
    detail: `cues=${cues}; repeatedRatio=${repeatedRatio.toFixed(4)}`,
    context: {
      cues,
      repeatedRatio: Number(repeatedRatio.toFixed(4)),
      tokenCount,
    },
  });

  return {
    nodularAttention: build("nodular-attention-memory", nodularAttention, attentionCues),
    nodularValue: build("nodular-value-memory", nodularValue, valueCues),
    nodularPriming: build("nodular-priming-memory", nodularPriming, primingCues),
    nodularState: build("nodular-state-memory", nodularState, tokenCount),
    nodularWeight: build("nodular-weights-memory", nodularWeight, tokenCount),
  };
}

function computeRegulatorySignal(
  normalizedText: string,
  constraints: string[],
  punctuationCount: number,
) {
  const stressCues = countMemoryMatches(normalizedText, /\b(erro|conflito|falha|incerto|bloque|stress|pressao|risco)\w*/g);
  const safetyCues = countMemoryMatches(normalizedText, /\b(estavel|coerente|validado|ok|seguro|confirmado)\w*/g);
  const strictConstraint = constraints.some((item) => /strict|critical|conflict|unsafe/i.test(item));
  const score = clamp01(
    0.24 +
    (Math.min(1, stressCues / 4) * 0.44) +
    (Math.min(1, punctuationCount / 8) * 0.12) -
    (Math.min(1, safetyCues / 4) * 0.2) +
    (strictConstraint ? 0.08 : 0),
  );
  return {
    ok: true,
    component: "regulatory-memory",
    score: Number(score.toFixed(4)),
    detail: `stressCues=${stressCues}; safetyCues=${safetyCues}; strictConstraint=${strictConstraint}`,
    context: {
      stressCues,
      safetyCues,
      strictConstraint,
      punctuationCount,
    },
  } satisfies LegacyMemorySignalOutput;
}

export interface LegacyMemorySignalsOutput {
  legacyMemory: {
    procedural: LegacyMemorySignalOutput;
    perceptual: LegacyMemorySignalOutput;
    metacognitive: LegacyMemorySignalOutput;
    prospective: LegacyMemorySignalOutput;
    social: LegacyMemorySignalOutput;
    value: LegacyMemorySignalOutput;
    attention: LegacyMemorySignalOutput;
  };
  nodular: {
    attention: LegacyMemorySignalOutput;
    value: LegacyMemorySignalOutput;
    priming: LegacyMemorySignalOutput;
    state: LegacyMemorySignalOutput;
    weight: LegacyMemorySignalOutput;
  };
  regulatory: LegacyMemorySignalOutput;
}

export function evaluateLegacyMemorySignals(input: LegacyMemorySignalsInput = {}): LegacyMemorySignalsOutput {
  const analysis = analyzeMemoryText(input.text);
  const repeatedRatio = repeatedTokenRatio(analysis.tokens);
  const patternScores = LEGACY_MEMORY_PATTERNS.map((pattern) =>
    computeSignal(pattern, analysis.normalized, analysis.tokenCount, analysis.punctuationCount),
  );
  const [
    procedural,
    perceptual,
    metacognitive,
    prospective,
    social,
    value,
    attention,
  ] = patternScores;
  const nodular = computeNodularSignals(
    analysis.normalized,
    analysis.tokenCount,
    analysis.punctuationCount,
    repeatedRatio,
  );
  const regulatory = computeRegulatorySignal(
    analysis.normalized,
    input.constraints || [],
    analysis.punctuationCount,
  );

  return {
    legacyMemory: {
      procedural,
      perceptual,
      metacognitive,
      prospective,
      social,
      value,
      attention,
    },
    nodular: {
      attention: nodular.nodularAttention,
      value: nodular.nodularValue,
      priming: nodular.nodularPriming,
      state: nodular.nodularState,
      weight: nodular.nodularWeight,
    },
    regulatory,
  };
}
