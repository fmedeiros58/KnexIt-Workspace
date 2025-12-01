import LoginPageClient from "../LoginPageClient";
import { DEFAULT_PRODUCT_SLUG, getProduct } from "@/lib/products";

export const dynamic = "force-dynamic";

type ProductLoginPageProps = {
  params: {
    productSlug: string;
  };
  searchParams: {
    from?: string;
    product?: string;
    redirect?: string;
  };
};

export default function ProductLoginPage({ params, searchParams }: ProductLoginPageProps) {
  const normalizedSlug = params.productSlug?.toLowerCase();
  const product = getProduct(normalizedSlug) ?? getProduct(DEFAULT_PRODUCT_SLUG);
  if (!product) {
    return (
      <LoginPageClient
        productSlug={DEFAULT_PRODUCT_SLUG}
        initialFrom={searchParams.from ?? null}
        initialProduct={searchParams.product ?? null}
        initialRedirect={searchParams.redirect ?? null}
      />
    );
  }
  return (
    <LoginPageClient
      productSlug={product.slug}
      initialFrom={searchParams.from ?? null}
      initialProduct={searchParams.product ?? null}
      initialRedirect={searchParams.redirect ?? null}
    />
  );
}
