export function normalizeDoi(doi: string | undefined): string | undefined {
  const cleaned = doi?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return cleaned || undefined;
}

