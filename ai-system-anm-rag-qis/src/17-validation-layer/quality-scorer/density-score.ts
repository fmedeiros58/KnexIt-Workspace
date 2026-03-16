export function scoreDensity(text: string): number {
  const words = text.trim().split(/\s+/g).filter(Boolean);
  if (!words.length) return 0;
  const unique = new Set(words.map((item) => item.toLowerCase()));
  const ratio = unique.size / words.length;
  return Number(Math.min(1, Math.max(0, ratio + Math.min(0.25, words.length / 700))).toFixed(4));
}
