"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getProduct } from "@/lib/products";
import { identitySupabase } from "@/lib/identitySupabaseClient";

type Cta = { label: string; href: string };

type LandingHeroProps = {
  badge: string;
  title: string;
  subtitle: string;
  primaryCta: Cta;
  secondaryCta: Cta;
};

const supabase = identitySupabase();

const PRODUCT_PILL_CLASS_BY_SLUG: Record<string, string> = {
  vioclass: "bg-indigo-100 text-indigo-700",
  violive: "bg-rose-100 text-rose-700",
  viorecord: "bg-red-100 text-red-700",
  viostudio: "bg-red-100 text-red-700",
  vioanalytics: "bg-cyan-100 text-cyan-700",
  viohub: "bg-orange-100 text-orange-700",
  supadrive: "bg-blue-100 text-blue-700",
  knexdocs: "bg-sky-100 text-sky-700",
  knexflow: "bg-emerald-100 text-emerald-700",
  knexchat: "bg-teal-100 text-teal-700",
  knexsearch: "bg-purple-100 text-purple-700",
  vioread: "bg-indigo-100 text-indigo-700",
  knexreview: "bg-emerald-100 text-emerald-700",
  knexai: "bg-fuchsia-100 text-fuchsia-700",
  knexmail: "bg-blue-100 text-blue-700",
  knexpay: "bg-slate-100 text-slate-700",
};

export default function LandingHero({
  badge,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
}: LandingHeroProps) {
  const [hasSession, setHasSession] = useState(false);
  const pathname = usePathname() ?? "";

  const landingContext = useMemo(() => {
    const landingMatch = pathname.match(/^\/landing-produtos\/([^/?#]+)/);
    const landingSlug = landingMatch?.[1] ?? null;
    const resolvedSlug = landingSlug === "landing-ia" ? "knexai" : landingSlug;
    const landingProduct = resolvedSlug ? getProduct(resolvedSlug) : null;

    const landingReturnTo = landingProduct ? landingProduct.homePath : null;

    const loginHref = landingReturnTo
      ? `/knexit-workspace/acesso?returnTo=${encodeURIComponent(landingReturnTo)}`
      : "/knexit-workspace/acesso?stay=1";

    return {
      isLanding: Boolean(landingMatch),
      productName: landingProduct?.name ?? "Knexspace",
      productSlug: resolvedSlug ?? null,
      loginHref,
    };
  }, [pathname]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(Boolean(session));
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const resolvedSecondaryCta = useMemo(() => {
    if (hasSession) {
      return { label: "Fazer login", href: landingContext.loginHref };
    }

    if (landingContext.isLanding) {
      return {
        label: `Teste o ${landingContext.productName} no trabalho`,
        href: landingContext.loginHref,
      };
    }

    return secondaryCta;
  }, [hasSession, landingContext, secondaryCta]);

  const badgeClassName = useMemo(() => {
    const tone = landingContext.productSlug ? PRODUCT_PILL_CLASS_BY_SLUG[landingContext.productSlug] : null;
    return tone ? `rounded-full px-3 py-1 shadow-sm ${tone}` : "rounded-full bg-white px-3 py-1 shadow-sm text-slate-700";
  }, [landingContext.productSlug]);

  const secondaryClassName =
    "rounded-full !bg-[#2f66ff] px-5 py-2 text-sm font-semibold !text-white no-underline shadow-sm hover:!bg-[#2557df]";

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-10 pt-14">
      <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 sm:justify-start">
          <span className={badgeClassName}>{badge}</span>
          <span className="normal-case text-sm font-bold tracking-normal text-blue-600 sm:text-base">knexspace One</span>
        </div>
        <div className="mx-auto max-w-3xl sm:mx-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">{subtitle}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
          <a
            href={primaryCta.href}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white no-underline shadow-sm hover:bg-emerald-700"
          >
            {primaryCta.label}
          </a>
          <a href={resolvedSecondaryCta.href} className={secondaryClassName}>
            {resolvedSecondaryCta.label}
          </a>
        </div>
      </div>
    </section>
  );
}
