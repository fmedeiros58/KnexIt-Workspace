export function normalizeEdition(edition: string | undefined): string | undefined {
  const normalized = edition?.trim();
  return normalized || undefined;
}

