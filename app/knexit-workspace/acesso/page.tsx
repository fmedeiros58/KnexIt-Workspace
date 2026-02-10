import AccessPageClient from "./AccessPageClient";

export const dynamic = "force-dynamic";

type AccessPageProps = {
  searchParams: {
    returnTo?: string;
    redirect?: string;
    from?: string;
  };
};

export default function AccessPage({ searchParams }: AccessPageProps) {
  const oauthRedirectUrl = process.env.IDENTITY_AUTH_REDIRECT_URL ?? null;
  return (
    <AccessPageClient
      oauthRedirectUrl={oauthRedirectUrl}
      initialReturnTo={searchParams.returnTo ?? searchParams.redirect ?? searchParams.from ?? null}
    />
  );
}
