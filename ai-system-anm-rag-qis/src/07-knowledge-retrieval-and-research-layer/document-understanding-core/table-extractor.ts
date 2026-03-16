export function extractTableLikeBlocks(text: string): string[] {
  return text
    .split(/\n/g)
    .map((line) => line.trim())
    .filter((line) => line.includes("|") || /\t/.test(line))
    .slice(0, 8);
}
