export type ProductSlug =
  | "supadrive"
  | "vioclass"
  | "violive"
  | "vioanalytics"
  | "vioread"
  | "viorecord"
  | "viostudio"
  | "knexai"
  | "knexflow"
  | "knexdocs"
  | "knexmail"
  | "knexpay"
  | "knexreview"
  | "knexsearch"
  | "knexchat";

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
    homePath: "/vioclass/web",
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
  knexflow: {
    slug: "knexflow",
    name: "KnexFlow",
    homePath: "/knexflow/web",
  },
  knexdocs: {
    slug: "knexdocs",
    name: "KnexDocs",
    homePath: "/knexdocs/web",
  },
  knexmail: {
    slug: "knexmail",
    name: "KnexMail",
    homePath: "/knexmail/web",
  },
  knexpay: {
    slug: "knexpay",
    name: "KnexPay",
    homePath: "/knexpay/web",
  },
  knexreview: {
    slug: "knexreview",
    name: "KnexReview",
    homePath: "/knexreview/web",
  },
  knexsearch: {
    slug: "knexsearch",
    name: "KnexSearch",
    homePath: "/knexsearch/web",
  },
  knexchat: {
    slug: "knexchat",
    name: "KnexChat",
    homePath: "/knexchat/web",
  },
};

export const DEFAULT_PRODUCT_SLUG: ProductSlug = "supadrive";

export function getProduct(slug: string | null | undefined): ProductEntry | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase() as ProductSlug;
  return PRODUCTS[normalized] ?? null;
}
