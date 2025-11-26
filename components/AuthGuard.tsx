"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const redirectTarget = useMemo(() => {
    const q = search?.toString();
    const current = q ? `${pathname}?${q}` : pathname;
    return encodeURIComponent(current);
  }, [pathname, search]);

  useEffect(() => {
    let mounted = true;
    const goLogin = () => {
      router.replace(`/login?redirect=${redirectTarget}`);
    };

    const check = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        goLogin();
      } else if (mounted) {
        setAuthorized(true);
      }
      if (mounted) setChecking(false);
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        goLogin();
      } else {
        setAuthorized(true);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [redirectTarget, router]);

  if (checking) return null;
  if (!authorized) return null;
  return <>{children}</>;
}
