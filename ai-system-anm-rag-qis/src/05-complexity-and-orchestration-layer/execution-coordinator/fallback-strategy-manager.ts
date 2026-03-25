import type { PipelineRoute } from "../../shared/enums/pipeline-enums";

export interface FallbackStrategyManagerInput {
  route: PipelineRoute;
  mode: string;
  complexityScore: number;
  ambiguity: number;
  safetyFlags: string[];
  hasSources: boolean;
}

export interface FallbackStrategyManagerOutput {
  primaryStrategy: string;
  secondaryStrategy: string;
  guardrails: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function hasHighRiskSafetyFlag(flags: string[]) {
  return flags.some((flag) => /(prompt_injection|malicious|harmful|safety_block)/i.test(flag));
}

export function fallbackStrategyManager(input: FallbackStrategyManagerInput): FallbackStrategyManagerOutput {
  const complexity = clamp01(input.complexityScore);
  const ambiguity = clamp01(input.ambiguity);

  if (hasHighRiskSafetyFlag(input.safetyFlags)) {
    return {
      primaryStrategy: "safe-refusal",
      secondaryStrategy: "guided-reframe",
      guardrails: ["strict_safety_tone", "avoid_operational_details"],
      ok: true,
      component: "fallback-strategy-manager",
      score: 0.96,
      detail: "safety-first fallback selected",
      context: {
        route: input.route,
        mode: input.mode,
      },
    };
  }

  if (!input.hasSources && input.route === "quantum-state") {
    return {
      primaryStrategy: "request-verifiable-context",
      secondaryStrategy: "minimal-claim-answer",
      guardrails: ["low-assertiveness", "explicit-uncertainty"],
      ok: true,
      component: "fallback-strategy-manager",
      score: 0.88,
      detail: "no sources for high-verifiability route",
      context: {
        route: input.route,
        hasSources: input.hasSources,
      },
    };
  }

  if (complexity >= 0.72 && ambiguity >= 0.45) {
    return {
      primaryStrategy: "clarifying-question-first",
      secondaryStrategy: "partial-answer-with-assumptions",
      guardrails: ["state-assumptions", "bounded-scope"],
      ok: true,
      component: "fallback-strategy-manager",
      score: 0.82,
      detail: "high complexity and ambiguity",
      context: {},
    };
  }

  if (input.mode === "research" || input.route === "quantum-state") {
    return {
      primaryStrategy: "evidence-first-compact",
      secondaryStrategy: "source-ranked-summary",
      guardrails: ["cite-where-possible", "avoid-overclaiming"],
      ok: true,
      component: "fallback-strategy-manager",
      score: 0.78,
      detail: "research-style fallback",
      context: {},
    };
  }

  if (complexity <= 0.34 && ambiguity <= 0.28) {
    return {
      primaryStrategy: "direct-answer",
      secondaryStrategy: "one-follow-up-option",
      guardrails: ["concise", "low-latency"],
      ok: true,
      component: "fallback-strategy-manager",
      score: 0.64,
      detail: "simple direct route",
      context: {},
    };
  }

  return {
    primaryStrategy: "conservative-synthesis",
    secondaryStrategy: "highlight-uncertainty",
    guardrails: ["balanced-tone", "progressive-depth"],
    ok: true,
    component: "fallback-strategy-manager",
    score: Number((0.58 + (complexity * 0.22) + (ambiguity * 0.12)).toFixed(4)),
    detail: "default fallback strategy",
    context: {
      route: input.route,
      mode: input.mode,
    },
  };
}
