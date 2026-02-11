"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { identitySupabase } from "@/lib/identitySupabaseClient";

const supabase = identitySupabase();

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

const getAppBaseUrl = () => {
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envBase) return normalizeBaseUrl(envBase);
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin);
  }
  return "https://knexspace.com";
};

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = async () => {
      try {
        const currentHref = typeof window !== "undefined" ? window.location.href : "";
        if (currentHref) {
          console.info("[auth] oauth_callback", { href: currentHref });
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(currentHref);
          if (exchangeError) {
            throw exchangeError;
          }
        }
      } catch (error) {
        console.error("[auth] exchangeCodeForSession failed", error);
        router.replace("/login");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        console.error("[auth] session not created");
        router.replace("/login");
        return;
      }

      const appBaseUrl = getAppBaseUrl();
      const stored = typeof window !== "undefined" ? localStorage.getItem("postAuthRedirect") : null;
      const oauthEntryPath =
        typeof window !== "undefined" ? localStorage.getItem("oauthEntryPath") : null;
      const oauthReturnTo =
        typeof window !== "undefined" ? localStorage.getItem("oauthReturnTo") : null;
      if (typeof window !== "undefined") {
        localStorage.removeItem("postAuthRedirect");
        localStorage.removeItem("oauthEntryPath");
        localStorage.removeItem("oauthReturnTo");
        localStorage.setItem("oauthPending", "1");
        const sessionEmail = sessionData?.session?.user?.email ?? "";
        if (sessionEmail) {
          localStorage.setItem("oauthPendingEmail", sessionEmail.toLowerCase());
        }
      }
      const fallback = "/knexit-workspace";
      const rawReturn = searchParams?.get("returnTo") || oauthReturnTo || stored || fallback;
      let safeReturn = rawReturn;
      try {
        const base = appBaseUrl;
        const url = new URL(rawReturn, base);
        const baseOrigin = new URL(base).origin;
        if (url.origin !== baseOrigin) {
          safeReturn = fallback;
        } else {
          const path = url.pathname || "/";
          if (path === "/login" || path.startsWith("/login/") || path.startsWith("/lobby")) {
            safeReturn = fallback;
          } else {
            safeReturn = `${path}${url.search}${url.hash}`;
          }
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
      const entryPath = oauthEntryPath || "/knexit-workspace/acesso";
      const redirectUrl = new URL(entryPath, appBaseUrl);
      redirectUrl.searchParams.set("returnTo", safeReturn);
      redirectUrl.searchParams.set("verify", "oauth");
      const redirectPath = `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
      console.info("[auth] oauth_callback_redirect", { to: redirectUrl.toString() });
      router.replace(redirectPath);
    };
    run();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white text-slate-700">
      <p>Finalizando acesso...</p>
    </main>
  );
}
