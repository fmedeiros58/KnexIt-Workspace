export function mergeDraftContent(chunks: string[]): string {
  return chunks.filter(Boolean).join("\n\n").trim();
}
