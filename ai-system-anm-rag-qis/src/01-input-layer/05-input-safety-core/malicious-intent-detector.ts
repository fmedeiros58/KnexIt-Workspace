export interface MaliciousIntentDetectorInput {
  text: string;
}

export interface MaliciousIntentDetectorOutput {
  flagged: boolean;
  riskLevel: "low" | "medium" | "high";
  flags: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const MALICIOUS_PATTERNS: Array<{ flag: string; level: "medium" | "high"; pattern: RegExp }> = [
  { flag: "credential_theft", level: "high", pattern: /\b(phishing|roubar senha|steal password|token leak|session hijack)\b/i },
  { flag: "malware", level: "high", pattern: /\b(ransomware|trojan|payload|shell reversa|reverse shell|keylogger)\b/i },
  { flag: "fraud", level: "medium", pattern: /\b(fraudar|scam|golpe|burlar sistema de pagamento|carding)\b/i },
  { flag: "unauthorized_access", level: "high", pattern: /\b(invadir|hackear|exploit|bypass auth|sql injection)\b/i },
];

export function maliciousIntentDetector(input: MaliciousIntentDetectorInput): MaliciousIntentDetectorOutput {
  const text = input.text || "";
  const matched = MALICIOUS_PATTERNS.filter((item) => item.pattern.test(text));
  const flags = matched.map((item) => item.flag);
  const high = matched.some((item) => item.level === "high");
  const flagged = flags.length > 0;
  const riskLevel: "low" | "medium" | "high" = high ? "high" : flagged ? "medium" : "low";
  const score = flagged
    ? Math.min(0.99, 0.62 + (flags.length * 0.1) + (high ? 0.15 : 0))
    : 0.07;

  return {
    flagged,
    riskLevel,
    flags,
    ok: !flagged,
    component: "malicious-intent-detector",
    score: Number(score.toFixed(4)),
    detail: flagged ? `${riskLevel}:${flags.join(",")}` : "clean",
    context: {
      matchedCount: flags.length,
      highRisk: high,
    },
  };
}
