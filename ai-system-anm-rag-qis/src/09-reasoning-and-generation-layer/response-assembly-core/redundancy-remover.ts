export function removeRedundancy(text: string): string {
  const lines = text.split(/\n+/g).map((line) => line.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }
  return unique.join("\n\n");
}
