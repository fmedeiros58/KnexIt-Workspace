function resolveHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function evaluateSourceTrust(url: string): number {
  const host = resolveHostname(url);
  if (!host) return 0.2;

  if (
    host.endsWith(".gov") ||
    host.endsWith(".gov.br") ||
    host.endsWith(".edu") ||
    host.endsWith(".edu.br") ||
    host.endsWith(".jus.br")
  ) {
    return 0.9;
  }
  if (host.includes("wikipedia.org") || host.includes("britannica.com")) return 0.76;
  if (host.includes("reuters.com") || host.includes("apnews.com") || host.includes("bbc.")) return 0.8;
  if (host.includes("stackoverflow.com") || host.includes("developer.mozilla.org") || host.includes("docs.")) return 0.74;
  if (host.includes("blog") || host.includes("forum") || host.includes("reddit.com") || host.includes("medium.com")) return 0.52;
  return 0.64;
}
