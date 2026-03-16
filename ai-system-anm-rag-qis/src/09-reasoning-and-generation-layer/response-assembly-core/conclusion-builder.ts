export function buildConclusion(input: {
  summary: string;
  epistemicStatus: string;
}): string {
  const summaryParts = `${input.summary || ""}`
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const summary = summaryParts.length
    ? summaryParts.sort((a, b) => b.length - a.length)[0]
    : "Sem conclusao disponivel";
  const status =
    input.epistemicStatus && input.epistemicStatus.toLowerCase() !== "unknown"
      ? ` (status ${input.epistemicStatus})`
      : "";
  return `Conclusao: ${summary}${status}.`;
}
