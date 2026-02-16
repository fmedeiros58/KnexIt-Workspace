"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { identitySupabase } from "@/lib/identitySupabaseClient";

const supabase = identitySupabase();

type ActivationStatus = {
  activated?: boolean;
  profile_completed?: boolean;
};

function resolveReturnTo(searchParams: ReturnType<typeof useSearchParams>) {
  const raw = searchParams?.get("returnTo") ?? "";
  if (!raw) return "/knexchat/web";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/knexchat/web";
  return raw;
}

export default function ActivationStartStepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRedirectedRef = useRef(false);
  const safeReturnTo = useMemo(() => resolveReturnTo(searchParams), [searchParams]);
  const activationPath = useMemo(
    () => `/knexchat/activate?returnTo=${encodeURIComponent(safeReturnTo)}`,
    [safeReturnTo],
  );
  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(activationPath)}`, [activationPath]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusChecking, setStatusChecking] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace(loginHref);
    }
  }, [loading, loginHref, router, session]);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (!session?.access_token) {
        throw new Error("unauthorized");
      }
      const headers = new Headers(init.headers ?? {});
      headers.set("Authorization", `Bearer ${session.access_token}`);
      return fetch(input, { ...init, headers });
    },
    [session?.access_token],
  );

  useEffect(() => {
    if (loading) return;
    if (!session?.access_token) {
      setStatusChecking(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await authFetch("/api/knexchat/activation/status");
        const payload = (await res.json().catch(() => null)) as ActivationStatus | null;
        if (!active) return;
        if (res.ok && payload?.activated) {
          if (hasRedirectedRef.current) return;
          hasRedirectedRef.current = true;
          const target =
            payload.profile_completed === false
              ? `/knexchat/activate/identity?returnTo=${encodeURIComponent(safeReturnTo)}&mode=ecosystem`
              : safeReturnTo;
          router.replace(target);
          return;
        }
      } catch {
        // Ignore status probe errors here and allow normal activation flow.
      } finally {
        if (active) {
          setStatusChecking(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [authFetch, loading, router, safeReturnTo, session?.access_token]);

  if (loading || statusChecking) {
    return (
      <main className="min-h-screen bg-[#f2f6fb] text-slate-900 flex items-center justify-center px-4">
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2f6fb] text-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_60px_-35px_rgba(15,23,42,0.45)]">
        <div className="mb-4 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          KnexChat
        </div>
        <h1 className="text-2xl font-semibold">Ativar KnexChat</h1>
        <p className="mt-2 text-sm text-slate-600">
          Etapa 1 de 3. Confirme que deseja iniciar o processo de ativacao.
        </p>

        <label className="mt-6 flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          <span>Confirmo que desejo ativar meu acesso ao KnexChat nesta conta.</span>
        </label>

        <button
          type="button"
          disabled={!accepted}
          onClick={() =>
            router.replace(`/knexchat/activate/email?start=1&returnTo=${encodeURIComponent(safeReturnTo)}`)
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
        >
          Continuar
        </button>
      </div>
    </main>
  );
}
