function normalize(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

function slugToKey(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
}

/**
 * Retorna a base URL do produto (sem barra final), priorizando:
 * 1) Variável específica por produto (NEXT_PUBLIC_APP_BASE_URL_<SLUG>)
 * 2) Variável alternativa por produto (NEXT_PUBLIC_APP_HOST_<SLUG>)
 * 3) Fallback geral (NEXT_PUBLIC_APP_BASE_URL_DEFAULT ou NEXT_PUBLIC_APP_BASE_URL ou NEXT_PUBLIC_SITE_URL)
 * 4) Host atual (via window.location.origin se disponível)
 */
export function getProductBaseUrl(slug: string): string {
  const key = slugToKey(slug);
  const candidates = [
    process.env[`NEXT_PUBLIC_APP_BASE_URL_${key}`],
    process.env[`NEXT_PUBLIC_APP_HOST_${key}`],
    process.env.NEXT_PUBLIC_APP_BASE_URL_DEFAULT,
    process.env.NEXT_PUBLIC_APP_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    typeof window !== "undefined" ? window.location.origin : undefined,
  ];

  const found = candidates.map(normalize).find(Boolean);
  return found || "";
}
