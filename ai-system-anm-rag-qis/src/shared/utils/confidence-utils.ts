export function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function meanConfidence(values: number[]) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, current) => acc + clampConfidence(current), 0);
  return sum / values.length;
}
