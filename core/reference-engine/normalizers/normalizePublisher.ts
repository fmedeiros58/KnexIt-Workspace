export function normalizePublisher(publisher: string | undefined): string | undefined {
  const normalized = publisher?.trim();
  return normalized || undefined;
}

