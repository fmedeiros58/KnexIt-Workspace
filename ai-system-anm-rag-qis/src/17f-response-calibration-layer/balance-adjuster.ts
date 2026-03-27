/** ai-system-anm */
export function adjustBalance(input: {
  text: string;
  tone: "neutral" | "warm" | "technical" | "supportive";
  formality: "low" | "medium" | "high";
}): string {
  let output = `${input.text || ""}`.trim();
  if (!output) return "";

  if (input.formality === "high") {
    output = output.replace(/\bvc\b/gi, "você");
  }

  if (input.tone === "technical") {
    output = output.replace(/^Entendi\.\s*/i, "").replace(/^Certo\.\s*/i, "");
  }

  return output;
}
