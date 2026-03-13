export interface HarmfulContentDetectorInput {
  text: string;
}

export interface HarmfulContentDetectorOutput {
  flagged: boolean;
  severity: "low" | "medium" | "high";
  flags: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const HARMFUL_PATTERNS: Array<{ flag: string; severity: "medium" | "high"; pattern: RegExp }> = [
  { flag: "self_harm_instruction", severity: "high", pattern: /\b(suic[ií]dio|me matar|self harm|kill myself|cortar os pulsos)\b/i },
  { flag: "violence_instruction", severity: "high", pattern: /\b(como matar|kill someone|fabricar bomba|build a bomb|explosivo caseiro)\b/i },
  { flag: "hate_content", severity: "medium", pattern: /\b(ra[çc]a inferior|odio a|hate (them|those people)|limpeza e[tç]nica)\b/i },
];

export function harmfulContentDetector(input: HarmfulContentDetectorInput): HarmfulContentDetectorOutput {
  const text = input.text || "";
  const matches = HARMFUL_PATTERNS.filter((item) => item.pattern.test(text));
  const flags = matches.map((item) => item.flag);
  const high = matches.some((item) => item.severity === "high");
  const flagged = flags.length > 0;
  const severity: "low" | "medium" | "high" = high ? "high" : flagged ? "medium" : "low";
  const score = flagged
    ? Math.min(0.99, 0.58 + (flags.length * 0.12) + (high ? 0.15 : 0))
    : 0.08;

  return {
    flagged,
    severity,
    flags,
    ok: !flagged,
    component: "harmful-content-detector",
    score: Number(score.toFixed(4)),
    detail: flagged ? `${severity}:${flags.join(",")}` : "clean",
    context: {
      matchedCount: flags.length,
      highRisk: high,
    },
  };
}
