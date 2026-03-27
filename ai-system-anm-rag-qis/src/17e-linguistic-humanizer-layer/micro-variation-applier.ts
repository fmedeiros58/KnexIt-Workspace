/** ai-system-anm */
export function applyMicroVariation(text: string, tone: "neutral" | "warm" | "technical" | "supportive"): string {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return "";
  if (/^(oi|ola|bom dia|boa tarde|boa noite|eu sou a leticia)\b/i.test(trimmed)) return trimmed;
  if (/^resposta:\s*/i.test(trimmed)) return trimmed;
  if (tone === "technical") return trimmed;
  if (tone === "supportive" && !/^Entendi\./i.test(trimmed)) return `Entendi. ${trimmed}`;
  if (tone === "warm" && !/^Certo\./i.test(trimmed)) return `Certo. ${trimmed}`;
  return trimmed;
}
