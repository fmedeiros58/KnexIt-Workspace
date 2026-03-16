export function buildCondensedDraft(text: string): string {
  const lines = text.split(/\n+/g).map((item) => item.trim()).filter(Boolean);
  return lines.slice(0, 5).join("\n\n");
}
