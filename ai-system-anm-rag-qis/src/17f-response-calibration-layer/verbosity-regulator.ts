/** ai-system-anm */
export function regulateVerbosity(text: string, density: "compact" | "balanced" | "detailed") {
  const value = `${text || ""}`.trim();
  if (!value) return value;
  if (density === "detailed") return value;

  const sentences = value.split(/(?<=[.!?])\s+/g).filter(Boolean);
  const limit = density === "compact" ? 3 : 6;
  if (sentences.length <= limit) return value;
  return sentences.slice(0, limit).join(" ").trim();
}
