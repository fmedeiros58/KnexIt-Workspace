export function normalizeTitle(title: string | undefined): string {
  return (title || "").trim();
}

export function normalizeSubtitle(subtitle: string | undefined): string | undefined {
  const normalized = subtitle?.trim();
  return normalized || undefined;
}

