"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { identitySupabase } from "@/lib/identitySupabaseClient";

const supabase = identitySupabase();

export default function AuthCallbackPage() {
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
      const returnTo = searchParams?.get("returnTo") || stored || "/knexit-workspace";
      router.replace(returnTo);
    };
    run();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white text-slate-700">
      <p>Finalizando acesso...</p>
    </main>
  );
}
