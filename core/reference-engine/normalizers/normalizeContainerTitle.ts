export function normalizeContainerTitle(containerTitle: string | undefined): string | undefined {
  const normalized = containerTitle?.trim();
  return normalized || undefined;
}

