export interface SensitiveDataDetectorInput {
  text: string;
}

export interface SensitiveDataDetectorOutput {
  hasSensitiveData: boolean;
  flags: string[];
  redactionSuggestion: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function maybeFlag(regex: RegExp, text: string, flag: string, out: string[]) {
  if (regex.test(text)) out.push(flag);
}

export function sensitiveDataDetector(input: SensitiveDataDetectorInput): SensitiveDataDetectorOutput {
  const text = input.text || "";
  const flags: string[] = [];

  maybeFlag(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, text, "email", flags);
  maybeFlag(/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/, text, "ssn_like", flags);
  maybeFlag(/\b\d{11}\b/, text.replace(/[^\d]/g, ""), "cpf_like", flags);
  maybeFlag(/\b(?:\d[ -]*?){13,19}\b/, text, "card_number_like", flags);
  maybeFlag(/\bsk-[A-Za-z0-9]{20,}\b/, text, "api_key_like", flags);
  maybeFlag(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/, text, "jwt_like", flags);

  const hasSensitiveData = flags.length > 0;
  const redactionSuggestion = [...new Set(flags.map((flag) => `redact:${flag}`))];
  const score = hasSensitiveData
    ? Math.min(0.98, 0.55 + (flags.length * 0.1))
    : 0.06;

  return {
    hasSensitiveData,
    flags,
    redactionSuggestion,
    ok: true,
    component: "sensitive-data-detector",
    score: Number(score.toFixed(4)),
    detail: hasSensitiveData ? flags.join(",") : "none",
    context: {
      hasSensitiveData,
      suggestionCount: redactionSuggestion.length,
    },
  };
}
