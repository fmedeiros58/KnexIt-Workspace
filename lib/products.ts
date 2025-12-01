export type ProductSlug =
  | "supadrive"
  | "vioclass"
  | "violive"
  | "vioanalytics"
  | "vioread"
  | "viorecord"
  | "viostudio"
  | "knexai";

export type ProductEntry = {
  slug: ProductSlug;
  name: string;
  homePath: string;
};

export const PRODUCTS: Record<ProductSlug, ProductEntry> = {
  supadrive: {
    slug: "supadrive",
    name: "SupaDrive",
    homePath: "/supadrive/web",
  },
  vioclass: {
    slug: "vioclass",
    name: "VioClass",
    homePath: "/vioclass",
  },
  violive: {
    slug: "violive",
    name: "VioLive",
    homePath: "/violive/web",
  },
  vioanalytics: {
    slug: "vioanalytics",
    name: "VioAnalytics",
    homePath: "/vioanalytics/web",
  },
  vioread: {
    slug: "vioread",
    name: "VioRead",
    homePath: "/vioread/web",
  },
  viorecord: {
    slug: "viorecord",
    name: "VioRecord",
    homePath: "/viorecord/web",
  },
  viostudio: {
    slug: "viostudio",
    name: "VioStudio",
    homePath: "/viostudio/web",
  },
  knexai: {
    slug: "knexai",
    name: "KnexAI",
    homePath: "/knexai/web",
  },
};

export const DEFAULT_PRODUCT_SLUG: ProductSlug = "supadrive";

export function getProduct(slug: string | null | undefined): ProductEntry | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase() as ProductSlug;
  return PRODUCTS[normalized] ?? null;
}
