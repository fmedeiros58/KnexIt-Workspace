"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { identitySupabase } from "@/lib/identitySupabaseClient";

const supabase = identitySupabase();

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = searchParams?.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
      const stored = typeof window !== "undefined" ? localStorage.getItem("postAuthRedirect") : null;
      if (typeof window !== "undefined") {
        localStorage.removeItem("postAuthRedirect");
      }
      const fallback = "/knexit-workspace";
      const rawReturn = searchParams?.get("returnTo") || stored || fallback;
      let safeReturn = rawReturn;
      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000";
        const url = new URL(rawReturn, origin);
        const path = url.pathname || "/";
        if (path === "/login" || path.startsWith("/login/") || path.startsWith("/lobby")) {
          safeReturn = fallback;
        } else {
          safeReturn = `${path}${url.search}${url.hash}`;
        }
      } catch {
        if (
          rawReturn === "/login" ||
          rawReturn.startsWith("/login/") ||
          rawReturn.startsWith("/lobby")
        ) {
          safeReturn = fallback;
        }
      }
      router.replace(safeReturn);
    };
    run();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white text-slate-700">
      <p>Finalizando acesso...</p>
    </main>
  );
}
