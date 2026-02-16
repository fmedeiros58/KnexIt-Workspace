"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { identitySupabase } from "@/lib/identitySupabaseClient";

type Mode = "ecosystem" | "custom";
type ActivationStatus = { activated?: boolean; profile_completed?: boolean };

const supabase = identitySupabase();

function resolveReturnTo(searchParams: ReturnType<typeof useSearchParams>) {
  const raw = searchParams?.get("returnTo") ?? "";
  if (!raw) return "/knexchat/web";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/knexchat/web";
  return raw;
}

export default function ActivationEmailStepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRedirectedRef = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("ecosystem");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeReturnTo = useMemo(() => resolveReturnTo(searchParams), [searchParams]);
  const started = useMemo(() => searchParams?.get("start") === "1", [searchParams]);
  const currentPath = useMemo(
    () => `/knexchat/activate/email?start=1&returnTo=${encodeURIComponent(safeReturnTo)}`,
    [safeReturnTo],
  );
  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(currentPath)}`, [currentPath]);
  const ecosystemEmail = useMemo(() => session?.user?.email?.trim().toLowerCase() ?? "", [session?.user?.email]);

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
    if (!started) {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace(`/knexchat/activate?returnTo=${encodeURIComponent(safeReturnTo)}`);
      return;
    }
  }, [router, safeReturnTo, started]);

  useEffect(() => {
    if (!loading && !session) {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace(loginHref);
    }
  }, [loading, session, loginHref, router]);

  useEffect(() => {
    if (!ecosystemEmail) return;
    if (mode === "ecosystem") {
      setEmail(ecosystemEmail);
    }
  }, [ecosystemEmail, mode]);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (!session?.access_token) throw new Error("unauthorized");
      const headers = new Headers(init.headers ?? {});
      headers.set("Authorization", `Bearer ${session.access_token}`);
      return fetch(input, { ...init, headers });
    },
    [session?.access_token],
  );

  useEffect(() => {
    if (!session?.access_token) return;
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
              ? `/knexchat/activate/identity?returnTo=${encodeURIComponent(safeReturnTo)}&mode=${mode}`
              : safeReturnTo;
          router.replace(target);
        }
      } catch {
        // Ignore status probe errors and keep activation flow available.
      }
    })();
    return () => {
      active = false;
    };
  }, [authFetch, mode, router, safeReturnTo, session?.access_token]);

  const handleSendCode = async () => {
    setError(null);
    const targetEmail = (email || "").trim().toLowerCase();
    if (!targetEmail) {
      setError("Informe um e-mail valido.");
      return;
    }
    if (mode === "ecosystem" && targetEmail !== ecosystemEmail) {
      setError("Use o e-mail do ecossistema neste modo.");
      return;
    }
    setSending(true);
    try {
      const res = await authFetch("/api/knexchat/activation/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, mode }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(payload?.message ?? "Falha ao enviar codigo.");
        return;
      }
      const next = `/knexchat/activate/code?returnTo=${encodeURIComponent(safeReturnTo)}&email=${encodeURIComponent(
        targetEmail,
      )}&mode=${mode}&start=1`;
      router.replace(next);
    } finally {
      setSending(false);
    }
  };

  const canSend = !sending && Boolean(email) && (mode === "custom" || email === ecosystemEmail);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f2f6fb] flex items-center justify-center px-4 text-slate-700">
        Carregando...
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
        <p className="mt-2 text-sm text-slate-600">Etapa 1 de 3. Escolha o e-mail e receba seu codigo.</p>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Qual e-mail usar?</p>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="radio"
                name="mode"
                checked={mode === "ecosystem"}
                onChange={() => setMode("ecosystem")}
                className="h-4 w-4 text-blue-600"
              />
              Usar meu e-mail do ecossistema ({ecosystemEmail || "indisponivel"})
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="radio"
                name="mode"
                checked={mode === "custom"}
                onChange={() => setMode("custom")}
                className="h-4 w-4 text-blue-600"
              />
              Usar outro e-mail para o KnexChat
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700">E-mail</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={mode === "ecosystem"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none disabled:opacity-70"
            placeholder="seu@email.com"
          />

          <button
            type="button"
            disabled={!canSend}
            onClick={handleSendCode}
            className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {sending ? "Enviando..." : "Enviar codigo"}
          </button>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
