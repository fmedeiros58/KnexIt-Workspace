export function normalizeOrganizationAuthor(organizationAuthor: string | undefined): string | undefined {
  const normalized = organizationAuthor?.trim();
  return normalized || undefined;
}

