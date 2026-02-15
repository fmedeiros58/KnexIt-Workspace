"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { identitySupabase } from "@/lib/identitySupabaseClient";

type ActivationStatus = {
  authenticated: boolean;
  activated: boolean;
  membership?: {
    status?: "pending" | "active" | "locked";
    knexchat_email?: string | null;
    email_verified_at?: string | null;
    activated_at?: string | null;
  } | null;
};

type Mode = "ecosystem" | "custom";
type Phase = "email" | "code";

const supabase = identitySupabase();

export default function ActivationPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [mode, setMode] = useState<Mode>("ecosystem");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("email");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const safeReturnTo = useMemo(() => {
    const raw = searchParams?.get("returnTo") ?? "";
    if (!raw) return "/knexchat/web";
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/knexchat/web";
    return raw;
  }, [searchParams]);

  const activationPath = useMemo(
    () => `/knexchat/activate?returnTo=${encodeURIComponent(safeReturnTo)}`,
    [safeReturnTo],
  );
  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(activationPath)}`, [activationPath]);

  const ecosystemEmail = useMemo(
    () => session?.user?.email?.trim().toLowerCase() ?? "",
    [session?.user?.email],
  );

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
      router.replace(loginHref);
    }
  }, [loading, session, loginHref, router]);

  useEffect(() => {
    if (!ecosystemEmail) return;
    if (mode === "ecosystem") {
      setEmail(ecosystemEmail);
    }
  }, [ecosystemEmail, mode]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

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

  const loadStatus = useCallback(async () => {
    if (!session) return;
    try {
      const res = await authFetch("/api/knexchat/activation/status");
      const payload = (await res.json().catch(() => null)) as ActivationStatus | null;
      if (!res.ok || !payload) {
        setError("Nao foi possivel carregar o status da ativacao.");
        return;
      }
      setStatus(payload);
      if (payload.activated) {
        router.replace(safeReturnTo);
      }
    } catch {
      setError("Nao foi possivel carregar o status da ativacao.");
    }
  }, [authFetch, router, safeReturnTo, session]);

  useEffect(() => {
    if (!session) return;
    loadStatus();
  }, [loadStatus, session]);

  const handleSendCode = async () => {
    setError(null);
    setNotice(null);
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
      const payload = (await res.json().catch(() => null)) as { message?: string; cooldown?: number } | null;
      if (!res.ok) {
        setError(payload?.message ?? "Falha ao enviar codigo.");
        return;
      }
      setPhase("code");
      setNotice("Codigo enviado para o e-mail informado.");
      if (payload?.cooldown) {
        setCooldown(payload.cooldown);
      } else {
        setCooldown(60);
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setNotice(null);
    const targetEmail = (email || "").trim().toLowerCase();
    if (!targetEmail) {
      setError("Informe um e-mail valido.");
      return;
    }
    if (!/^[0-9]{6}$/.test(code)) {
      setError("Informe o codigo de 6 digitos.");
      return;
    }
    setVerifying(true);
    try {
      const res = await authFetch("/api/knexchat/activation/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, code }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(payload?.message ?? "Falha ao validar codigo.");
        return;
      }
      router.replace(safeReturnTo);
    } finally {
      setVerifying(false);
    }
  };

  const canSend = !sending && Boolean(email) && (mode === "custom" || email === ecosystemEmail);
  const canVerify = !verifying && /^[0-9]{6}$/.test(code);

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
        <p className="mt-2 text-sm text-slate-600">
          Confirme seu e-mail para liberar o acesso ao KnexChat.
        </p>

        {status?.membership?.status === "locked" ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Sua ativacao foi bloqueada. Entre em contato com o suporte.
          </p>
        ) : null}

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

          {phase === "email" ? (
            <button
              type="button"
              disabled={!canSend}
              onClick={handleSendCode}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? "Enviando..." : "Enviar codigo"}
            </button>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Codigo de 6 digitos</label>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center tracking-[0.4em] text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                placeholder="000000"
                inputMode="numeric"
              />
              <button
                type="button"
                disabled={!canVerify}
                onClick={handleVerify}
                className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
              >
                {verifying ? "Validando..." : "Confirmar codigo"}
              </button>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  disabled={sending || cooldown > 0}
                  onClick={handleSendCode}
                  className="font-semibold text-blue-700 hover:underline disabled:text-slate-400"
                >
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar codigo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase("email");
                    setCode("");
                  }}
                  className="font-semibold text-slate-600 hover:underline"
                >
                  Trocar e-mail
                </button>
              </div>
            </div>
          )}

          {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
