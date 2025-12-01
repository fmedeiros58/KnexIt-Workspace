"use client";

import LoginPageClient from "./LoginPageClient";
import { DEFAULT_PRODUCT_SLUG } from "@/lib/products";

export const dynamic = "force-dynamic";

type LoginPageRouteProps = {
  searchParams: {
    from?: string;
    product?: string;
    redirect?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageRouteProps) {
  return (
    <LoginPageClient
      productSlug={DEFAULT_PRODUCT_SLUG}
      initialFrom={searchParams.from ?? null}
      initialProduct={searchParams.product ?? null}
      initialRedirect={searchParams.redirect ?? null}
    />
  );
}
