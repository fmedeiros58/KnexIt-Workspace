const DEIXIS_PATTERNS: RegExp[] = [
  /\b(isso|isto|aquilo|esse|essa|este|esta|aquele|aquela)\b/gi,
  /\b(aqui|ali|la|aqui mesmo|nesse caso|neste caso|desse jeito|assim|entao)\b/gi,
  /\b(esse ponto|esse trecho|nessa parte|na outra parte|antes|depois)\b/gi,
];

export function countDeixisSignals(text: string): number {
  const source = `${text || ""}`.toLowerCase();
  let count = 0;
  for (const pattern of DEIXIS_PATTERNS) {
    count += (source.match(pattern) || []).length;
  }
  return count;
}

export function hasDeicticReference(text: string): boolean {
  return countDeixisSignals(text) > 0;
}
