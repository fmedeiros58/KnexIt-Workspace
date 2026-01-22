"use client";

import LoginPageClient from "./LoginPageClient";

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
      initialFrom={searchParams.from ?? null}
      initialProduct={searchParams.product ?? null}
      initialRedirect={searchParams.redirect ?? null}
    />
  );
}
