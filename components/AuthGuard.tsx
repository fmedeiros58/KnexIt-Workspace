"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import { getProduct } from "@/lib/products";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthGuardInner>{children}</AuthGuardInner>
    </Suspense>
  );
}

function AuthGuardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const supabase = useMemo(() => identitySupabase(), []);
  const trustedKey = "knex_trusted_accounts";

  const isTrustedAccount = (email?: string | null) => {
    if (!email || typeof window === "undefined") return false;
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
    try {
      const raw = localStorage.getItem(trustedKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) return false;
      return parsed.includes(normalized);
    } catch {
      return false;
    }
  };

  const normalizeRedirectPath = (path: string): string => {
    const parts = path.split("?")[0].split("/").filter(Boolean);
    const slug = parts[0];
    if (!slug) return path;
    const product = getProduct(slug);
    if (product && (path === `/${slug}` || path.startsWith(`/lobby/${slug}`))) {
      return product.homePath;
    }
    return path;
  };

  const redirectTarget = useMemo(() => {
    const safePath = pathname ?? "/";
    const q = search?.toString();
    const current = q ? `${safePath}?${q}` : safePath;
    const normalized = normalizeRedirectPath(current);
    return encodeURIComponent(normalized);
  }, [pathname, search]);

  useEffect(() => {
    let mounted = true;
    const goLogin = (verify?: "otp") => {
      if (verify === "otp") {
        router.replace(`/knexit-workspace/acesso?returnTo=${redirectTarget}&verify=otp`);
        return;
      }
      router.replace(`/knexit-workspace/acesso?returnTo=${redirectTarget}`);
    };

    const check = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        goLogin();
        return;
      }
      const metadata = data.session.user?.user_metadata as { email_verified_by_code_at?: string } | null;
      const email = data.session.user?.email ?? null;
      if (!metadata?.email_verified_by_code_at && !isTrustedAccount(email)) {
        goLogin("otp");
        return;
      }
      if (mounted) {
        setAuthorized(true);
      }
      if (mounted) setChecking(false);
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        goLogin();
      } else {
        const metadata = session.user?.user_metadata as { email_verified_by_code_at?: string } | null;
        const email = session.user?.email ?? null;
        if (!metadata?.email_verified_by_code_at && !isTrustedAccount(email)) {
          goLogin("otp");
          return;
        }
        setAuthorized(true);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [redirectTarget, router, supabase]);

  if (checking) return null;
  if (!authorized) return null;
  return <>{children}</>;
}
