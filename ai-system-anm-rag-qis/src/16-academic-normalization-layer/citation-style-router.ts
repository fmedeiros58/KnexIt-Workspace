export type CitationStyle = "none" | "abnt" | "apa" | "mla" | "chicago" | "vancouver";

export interface CitationStyleRouterInput {
  mode: string;
  constraints: string[];
}

export function citationStyleRouter(input: CitationStyleRouterInput): CitationStyle {
  const constraints = (input.constraints || []).join(" ").toLowerCase();
  if (/\babnt\b/.test(constraints)) return "abnt";
  if (/\bapa\b/.test(constraints)) return "apa";
  if (/\bmla\b/.test(constraints)) return "mla";
  if (/\bchicago\b/.test(constraints)) return "chicago";
  if (/\bvancouver\b/.test(constraints)) return "vancouver";
  if (input.mode === "research" || input.mode === "analysis") return "apa";
  return "none";
}
