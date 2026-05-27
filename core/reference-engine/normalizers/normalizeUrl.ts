export function normalizeUrl(url: string | undefined): string | undefined {
  const cleaned = url?.trim();
  if (!cleaned) return undefined;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

