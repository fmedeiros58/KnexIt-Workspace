export function normalizePlace(place: string | undefined): string | undefined {
  const normalized = place?.trim();
  return normalized || undefined;
}

