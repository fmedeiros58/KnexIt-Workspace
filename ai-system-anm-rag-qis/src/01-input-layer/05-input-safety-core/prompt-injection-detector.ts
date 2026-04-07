export interface PromptInjectionDetectorInput {
  text: string;
}

export interface PromptInjectionDetectorOutput {
  flagged: boolean;
  severity: "low" | "medium" | "high";
  confidence: number;
  flags: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const INJECTION_PATTERNS: Array<{ flag: string; severity: "medium" | "high"; pattern: RegExp }> = [
  { flag: "override_instructions", severity: "high", pattern: /\b(ignore|disregard|esque[aç]a|ignora).{0,60}\b(instruction|prompt|sistema|previous|anterior)\b/i },
  { flag: "reveal_system_prompt", severity: "high", pattern: /\b(show|reveal|exiba|mostre).{0,60}\b(system prompt|prompt do sistema|hidden prompt|mensagem oculta)\b/i },
  { flag: "policy_bypass_request", severity: "high", pattern: /\b(bypass|override|contorne|drible).{0,40}\b(policy|safety|guardrail|regra)\b/i },
  { flag: "privilege_escalation_hint", severity: "medium", pattern: /\b(sudo|root|admin|drop table|rm\s+-rf)\b/i },
  { flag: "xml_role_injection", severity: "medium", pattern: /<\s*(system|assistant|developer)\s*>/i },
];

export function promptInjectionDetector(input: PromptInjectionDetectorInput): PromptInjectionDetectorOutput {
  const text = input.text || "";
  const matched = INJECTION_PATTERNS.filter((item) => item.pattern.test(text));
  const flags = matched.map((item) => item.flag);
  const highCount = matched.filter((item) => item.severity === "high").length;

  const flagged = flags.length > 0;
  const severity: "low" | "medium" | "high" = highCount > 0 ? "high" : flagged ? "medium" : "low";
  const confidence = flagged
    ? Math.min(0.98, 0.58 + (flags.length * 0.14) + (highCount * 0.12))
    : 0.2;

  return {
    flagged,
    severity,
    confidence: Number(confidence.toFixed(4)),
    flags,
    ok: !flagged,
    component: "prompt-injection-detector",
    score: Number(confidence.toFixed(4)),
    detail: flagged ? `${severity}:${flags.join(",")}` : "clean",
    context: {
      flagged,
      severity,
      matchedCount: flags.length,
    },
  };
}
