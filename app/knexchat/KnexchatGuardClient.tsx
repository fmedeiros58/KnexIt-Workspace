"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { identitySupabase } from "@/lib/identitySupabaseClient";

const supabase = identitySupabase();

type ActivationStatus = {
  activated?: boolean;
};

export default function KnexchatGuardClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const returnTo = useMemo(() => {
    const query = search?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, search]);

  const activationPath = useMemo(
    () => `/knexchat/activate?returnTo=${encodeURIComponent(returnTo || "/knexchat/web")}`,
    [returnTo],
  );

  const loginPath = useMemo(() => `/login?next=${encodeURIComponent(activationPath)}`, [activationPath]);

  useEffect(() => {
    if (pathname.startsWith("/knexchat/activate")) {
      setAuthorized(true);
      setChecking(false);
      return;
    }

    let active = true;

    const checkActivation = async (token: string) => {
      const res = await fetch("/api/knexchat/activation/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json().catch(() => null)) as ActivationStatus | null;
      if (!active) return;
      if (!res.ok || !payload?.activated) {
        router.replace(activationPath);
        return;
      }
      setAuthorized(true);
      setChecking(false);
    };

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const session = data?.session;
      if (!session?.access_token) {
        router.replace(loginPath);
        return;
      }
      await checkActivation(session.access_token);
    };

    checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token) {
        router.replace(loginPath);
        return;
      }
      checkActivation(session.access_token);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [activationPath, loginPath, pathname, router]);

  if (checking) return null;
  if (!authorized) return null;
  return <>{children}</>;
}
