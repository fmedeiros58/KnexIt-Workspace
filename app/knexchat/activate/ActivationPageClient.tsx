"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import {
  getNicknameErrorMessage,
  getNicknameRulesLabel,
  validateNickname,
} from "@/lib/knexchat/nickname";

type ActivationStatus = {
  authenticated: boolean;
  has_profile: boolean;
  has_nickname: boolean;
  activated: boolean;
  profile: {
    nickname: string | null;
    display_name: string | null;
    terms_accepted_at: string | null;
    activated_at: string | null;
  } | null;
};

type NicknameStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "reserved";

const supabase = identitySupabase();

export default function ActivationPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>("idle");
  const [nicknameMessage, setNicknameMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
  const loginHref = useMemo(
    () => `/login?next=${encodeURIComponent(activationPath)}`,
    [activationPath],
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
    if (loading) return;
    if (!session) {
      router.replace(loginHref);
    }
  }, [loading, session, loginHref, router]);

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
    const res = await authFetch("/api/knexchat/activation/status");
    const payload = (await res.json().catch(() => null)) as ActivationStatus | null;
    if (!res.ok || !payload) {
      setFormError("Nao foi possivel carregar o status da ativacao.");
      return;
    }
    setStatus(payload);
    if (payload.profile?.display_name) {
      setDisplayName(payload.profile.display_name);
    } else if (session.user?.user_metadata) {
      const metadata = session.user.user_metadata as { name?: string; full_name?: string } | null;
      const fallbackName = metadata?.name || metadata?.full_name || "";
      if (fallbackName) setDisplayName(fallbackName);
    }
    if (payload.profile?.terms_accepted_at) {
      setTermsAccepted(true);
    }
    if (payload.activated) {
      router.replace(safeReturnTo);
    }
  }, [authFetch, router, safeReturnTo, session]);

  useEffect(() => {
    if (!session) return;
    loadStatus();
  }, [loadStatus, session]);

  const loadSuggestions = useCallback(
    async (base?: string) => {
      if (!session) return;
      const res = await authFetch("/api/knexchat/nickname/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base }),
      });
      const payload = (await res.json().catch(() => null)) as { suggestions?: string[] } | null;
      if (!res.ok || !payload?.suggestions) return;
      setSuggestions(payload.suggestions);
      if (!nickname && payload.suggestions[0]) {
        setNickname(payload.suggestions[0]);
      }
    },
    [authFetch, nickname, session],
  );

  useEffect(() => {
    if (!session) return;
    if (!status) return;
    const base = displayName || session.user?.email?.split("@")[0] || "";
    loadSuggestions(base);
  }, [displayName, loadSuggestions, session, status]);

  useEffect(() => {
    if (!nickname) {
      setNicknameStatus("idle");
      setNicknameMessage(null);
      return;
    }
    const validation = validateNickname(nickname);
    if (!validation.ok) {
      setNicknameStatus("invalid");
      setNicknameMessage(getNicknameErrorMessage(validation.error));
      return;
    }

    setNicknameStatus("checking");
    setNicknameMessage(null);
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const res = await authFetch(
          `/api/knexchat/nickname/check?value=${encodeURIComponent(nickname)}`,
        );
        const payload = (await res.json().catch(() => null)) as
          | { ok: boolean; available?: boolean; error?: string }
          | null;
        if (!active) return;
        if (!res.ok || !payload) {
          setNicknameStatus("invalid");
          setNicknameMessage("Nao foi possivel validar agora.");
          return;
        }
        if (!payload.ok) {
          const isReserved = payload.error === "reserved";
          setNicknameStatus(isReserved ? "reserved" : "invalid");
          setNicknameMessage(isReserved ? "Esse nickname esta reservado." : "Formato invalido.");
          return;
        }
        setNicknameStatus(payload.available ? "available" : "taken");
        setNicknameMessage(payload.available ? "Disponivel" : "Indisponivel");
      } catch {
        if (!active) return;
        setNicknameStatus("invalid");
        setNicknameMessage("Nao foi possivel validar agora.");
      }
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [authFetch, nickname]);

  const handleActivate = async () => {
    setFormError(null);
    const validation = validateNickname(nickname);
    if (!validation.ok) {
      setNicknameStatus("invalid");
      setNicknameMessage(getNicknameErrorMessage(validation.error));
      return;
    }
    if (!termsAccepted && !status?.profile?.terms_accepted_at) {
      setFormError("Voce precisa aceitar os termos para continuar.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/knexchat/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          display_name: displayName || undefined,
          accept_terms: termsAccepted,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
      if (!res.ok) {
        if (payload?.code === "nickname_taken") {
          setNicknameStatus("taken");
          setNicknameMessage("Esse nickname ja esta em uso.");
          await loadSuggestions(nickname);
          return;
        }
        if (payload?.code === "terms_required") {
          setFormError("Voce precisa aceitar os termos para continuar.");
          return;
        }
        setFormError(payload?.message ?? "Falha ao ativar.");
        return;
      }
      router.replace(safeReturnTo);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    nicknameStatus === "available" &&
    !submitting &&
    (termsAccepted || Boolean(status?.profile?.terms_accepted_at));

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
          Escolha um nickname publico para entrar no KnexChat.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Nickname</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              placeholder="seu.nick"
            />
          </div>
          <p className="text-xs text-slate-500">{getNicknameRulesLabel()}</p>
          {nicknameMessage ? (
            <p
              className={`text-xs ${
                nicknameStatus === "available"
                  ? "text-emerald-600"
                  : nicknameStatus === "checking"
                    ? "text-slate-500"
                    : "text-rose-600"
              }`}
            >
              {nicknameStatus === "checking" ? "Verificando..." : nicknameMessage}
            </p>
          ) : null}

          {suggestions.length ? (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setNickname(suggestion)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  @{suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <label className="block text-sm font-semibold text-slate-700">Nome de exibicao (opcional)</label>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            placeholder="Como voce quer ser chamado"
          />

          {!status?.profile?.terms_accepted_at ? (
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Concordo com os Termos de Servico e Politica de Privacidade.</span>
            </label>
          ) : null}

          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleActivate}
            className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Ativando..." : "Ativar"}
          </button>
        </div>
      </div>
    </main>
  );
}
