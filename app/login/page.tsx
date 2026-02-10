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
  const oauthRedirectUrl = process.env.IDENTITY_AUTH_REDIRECT_URL ?? null;
  return (
    <LoginPageClient
      initialFrom={searchParams.from ?? null}
      initialProduct={searchParams.product ?? null}
      initialRedirect={searchParams.redirect ?? null}
      oauthRedirectUrl={oauthRedirectUrl}
    />
  );
}
