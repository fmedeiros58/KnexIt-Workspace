"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import {
  resolveIdentityAvatarUrl,
  resolveIdentityDisplayName,
  writeKnexchatProfileSeed,
  type IdentityMetadata,
} from "@/lib/knexchat/profileSeed";

type Mode = "ecosystem" | "custom";
type ActivationStatus = { activated?: boolean; profile_completed?: boolean };

const supabase = identitySupabase();

function resolveReturnTo(searchParams: ReturnType<typeof useSearchParams>) {
  const raw = searchParams?.get("returnTo") ?? "";
  if (!raw) return "/knexchat/web";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/knexchat/web";
  return raw;
}

export default function ActivationCodeStepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRedirectedRef = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const safeReturnTo = useMemo(() => resolveReturnTo(searchParams), [searchParams]);
  const started = useMemo(() => searchParams?.get("start") === "1", [searchParams]);
  const email = useMemo(() => (searchParams?.get("email") ?? "").trim().toLowerCase(), [searchParams]);
  const mode = useMemo<Mode>(() => (searchParams?.get("mode") === "custom" ? "custom" : "ecosystem"), [searchParams]);
  const metadata = useMemo(
    () => (session?.user?.user_metadata as IdentityMetadata) ?? null,
    [session?.user?.user_metadata],
  );
  const ecosystemAvatarUrl = useMemo(() => resolveIdentityAvatarUrl(metadata), [metadata]);
  const ecosystemDisplayName = useMemo(
    () => resolveIdentityDisplayName(metadata, session?.user?.email ?? ""),
    [metadata, session?.user?.email],
  );

  const currentPath = useMemo(
    () =>
      `/knexchat/activate/code?returnTo=${encodeURIComponent(safeReturnTo)}&email=${encodeURIComponent(
        email,
      )}&mode=${mode}&start=1`,
    [safeReturnTo, email, mode],
  );
  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(currentPath)}`, [currentPath]);
  const identityPath = useMemo(
    () =>
      `/knexchat/activate/identity?returnTo=${encodeURIComponent(safeReturnTo)}&email=${encodeURIComponent(
        email,
      )}&mode=${mode}&start=1`,
    [safeReturnTo, email, mode],
  );

  useEffect(() => {
    if (!started) {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace(`/knexchat/activate?returnTo=${encodeURIComponent(safeReturnTo)}`);
      return;
    }
    if (!email) {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace(`/knexchat/activate/email?start=1&returnTo=${encodeURIComponent(safeReturnTo)}`);
    }
  }, [email, router, safeReturnTo, started]);

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
  }, [loading, session, loginHref, router]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

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
          const target = payload.profile_completed === false ? identityPath : safeReturnTo;
          router.replace(target);
        }
      } catch {
        // Ignore status probe errors and keep activation flow available.
      }
    })();
    return () => {
      active = false;
    };
  }, [authFetch, identityPath, router, safeReturnTo, session?.access_token]);

  const handleResend = async () => {
    if (!email) return;
    setError(null);
    setNotice(null);
    setSending(true);
    try {
      const res = await authFetch("/api/knexchat/activation/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string; cooldown?: number } | null;
      if (!res.ok) {
        setError(payload?.message ?? "Falha ao reenviar codigo.");
        return;
      }
      setNotice("Codigo reenviado com sucesso.");
      setCooldown(payload?.cooldown ?? 60);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setNotice(null);
    if (!/^[0-9]{6}$/.test(code)) {
      setError("Informe o codigo de 6 digitos.");
      return;
    }
    setVerifying(true);
    try {
      const res = await authFetch("/api/knexchat/activation/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(payload?.message ?? "Falha ao validar codigo.");
        return;
      }
      if (mode === "ecosystem" && session?.user?.id && (ecosystemAvatarUrl || ecosystemDisplayName)) {
        writeKnexchatProfileSeed(session.user.id, {
          ...(ecosystemAvatarUrl ? { avatarUrl: ecosystemAvatarUrl } : {}),
          ...(ecosystemDisplayName ? { displayName: ecosystemDisplayName } : {}),
          source: "ecosystem",
          createdAt: new Date().toISOString(),
        });
      }
      router.replace(identityPath);
    } finally {
      setVerifying(false);
    }
  };

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
        <h1 className="text-2xl font-semibold">Confirmar codigo</h1>
        <p className="mt-2 text-sm text-slate-600">Etapa 2 de 3. Digite o codigo enviado para {email || "seu e-mail"}.</p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="block text-sm font-semibold text-slate-700">E-mail cadastrado</span>
            <input
              value={email}
              readOnly
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">Foto inicial do KnexChat</p>
            {mode === "ecosystem" ? (
              ecosystemAvatarUrl ? (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={ecosystemAvatarUrl}
                    alt="Avatar do ecossistema"
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                  <p className="text-xs text-slate-600">
                    Sua foto do ecossistema sera importada automaticamente como imagem inicial do KnexChat.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-600">
                  Nao encontramos foto no perfil do ecossistema. Voce podera adicionar uma imagem depois dentro do KnexChat.
                </p>
              )
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                Neste modo (outro e-mail), a importacao automatica da foto do ecossistema nao e aplicada.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-3">
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
              onClick={handleResend}
              className="font-semibold text-blue-700 hover:underline disabled:text-slate-400"
            >
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : sending ? "Enviando..." : "Reenviar codigo"}
            </button>
            <button
              type="button"
              onClick={() =>
                router.replace(`/knexchat/activate/email?start=1&returnTo=${encodeURIComponent(safeReturnTo)}`)
              }
              className="font-semibold text-slate-600 hover:underline"
            >
              Trocar e-mail
            </button>
          </div>
          {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
