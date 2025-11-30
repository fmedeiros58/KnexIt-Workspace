export type ProductSlug =
  | "supadrive"
  | "vioclass"
  | "violive"
  | "vioread"
  | "vioanalytics"
  | "viorecord"
  | "viostudio"
  | "knexai"
  | "knexchat"
  | "knexdocs"
  | "knexflow"
  | "knexmail"
  | "knexpay"
  | "knexreview"
  | "knexsearch"
  | "knexit-workspace";

export type ProductEntry = {
  slug: ProductSlug;
  name: string;
  homePath: string;
};

export const PRODUCTS: Record<ProductSlug, ProductEntry> = {
  supadrive: {
    slug: "supadrive",
    name: "SupaDrive",
    homePath: "/supadrive",
  },
  vioclass: {
    slug: "vioclass",
    name: "VioClass",
    homePath: "/vioclass",
  },
  violive: {
    slug: "violive",
    name: "VioLive",
    homePath: "/violive",
  },
  vioread: {
    slug: "vioread",
    name: "VioRead",
    homePath: "/vioread",
  },
  vioanalytics: {
    slug: "vioanalytics",
    name: "VioAnalytics",
    homePath: "/vioanalytics",
  },
  viorecord: {
    slug: "viorecord",
    name: "VioRecord",
    homePath: "/viorecord",
  },
  viostudio: {
    slug: "viostudio",
    name: "VioStudio",
    homePath: "/viostudio",
  },
  knexai: {
    slug: "knexai",
    name: "KnexAI",
    homePath: "/knexai",
  },
  knexchat: {
    slug: "knexchat",
    name: "KnexChat",
    homePath: "/knexchat",
  },
  knexdocs: {
    slug: "knexdocs",
    name: "KnexDocs",
    homePath: "/knexdocs",
  },
  knexflow: {
    slug: "knexflow",
    name: "KnexFlow",
    homePath: "/knexflow",
  },
  knexmail: {
    slug: "knexmail",
    name: "KnexMail",
    homePath: "/knexmail",
  },
  knexpay: {
    slug: "knexpay",
    name: "KnexPay",
    homePath: "/knexpay",
  },
  knexreview: {
    slug: "knexreview",
    name: "KnexReview",
    homePath: "/knexreview",
  },
  knexsearch: {
    slug: "knexsearch",
    name: "KnexSearch",
    homePath: "/knexsearch",
  },
  "knexit-workspace": {
    slug: "knexit-workspace",
    name: "KnexIT Workspace",
    homePath: "/knexit-workspace",
  },
};

export const DEFAULT_PRODUCT_SLUG: ProductSlug = "supadrive";

export function getProduct(slug: string | null | undefined): ProductEntry | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase() as ProductSlug;
  return PRODUCTS[normalized] ?? null;
}
