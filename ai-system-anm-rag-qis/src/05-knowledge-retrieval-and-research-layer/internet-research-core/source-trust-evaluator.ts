export function evaluateSourceTrust(url: string): number {
  const normalized = url.trim().toLowerCase();
  if (!normalized || normalized === "about:blank") return 0.2;
  if (/(gov|edu|org)/.test(normalized)) return 0.85;
  if (/(wikipedia|britannica)/.test(normalized)) return 0.74;
  if (/(blog|forum|social)/.test(normalized)) return 0.45;
  return 0.62;
}
