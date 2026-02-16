"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import {
  getNicknameErrorMessage,
  normalizeNickname,
  validateNickname,
} from "@/lib/knexchat/nickname";
import {
  getKnexchatPreferencesKey,
  readKnexchatProfileSeed,
  resolveIdentityAvatarUrl,
  resolveIdentityDisplayName,
  writeKnexchatProfileSeed,
  type IdentityMetadata,
} from "@/lib/knexchat/profileSeed";

const supabase = identitySupabase();

type ActivationStatus = {
  activated?: boolean;
  profile_completed?: boolean;
  membership?: {
    knexchat_email?: string | null;
  } | null;
  profile?: {
    nickname?: string | null;
    nickname_normalized?: string | null;
    display_name?: string | null;
    terms_accepted_at?: string | null;
  } | null;
};

type NicknameCheckPayload = {
  ok?: boolean;
  available?: boolean;
  error?: string;
};

type NicknameSuggestPayload = {
  suggestions?: string[];
};

type Mode = "ecosystem" | "custom";

function resolveReturnTo(searchParams: ReturnType<typeof useSearchParams>) {
  const raw = searchParams?.get("returnTo") ?? "";
  if (!raw) return "/knexchat/web";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/knexchat/web";
  return raw;
}

const sanitizeAvatarUrl = (value: string) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "";
};

const getMetadata = (session: Session | null): IdentityMetadata => {
  if (!session?.user) return null;
  return (session.user.user_metadata as IdentityMetadata) ?? null;
};

export default function ActivationIdentityStepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRedirectedRef = useRef(false);
  const initializedRef = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [handleChecking, setHandleChecking] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [handleHint, setHandleHint] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [privateAccount, setPrivateAccount] = useState(true);
  const [discoverByEmail, setDiscoverByEmail] = useState(true);

  const safeReturnTo = useMemo(() => resolveReturnTo(searchParams), [searchParams]);
  const queryMode = useMemo<Mode | null>(() => {
    const raw = searchParams?.get("mode");
    if (raw === "custom") return "custom";
    if (raw === "ecosystem") return "ecosystem";
    return null;
  }, [searchParams]);
  const queryEmail = useMemo(() => (searchParams?.get("email") ?? "").trim().toLowerCase(), [searchParams]);

  const currentPath = useMemo(
    () =>
      `/knexchat/activate/identity?returnTo=${encodeURIComponent(safeReturnTo)}&email=${encodeURIComponent(
        queryEmail,
      )}&mode=${queryMode ?? "ecosystem"}&start=1`,
    [queryMode, queryEmail, safeReturnTo],
  );
  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(currentPath)}`, [currentPath]);

  const metadata = useMemo(() => getMetadata(session), [session]);
  const [ecosystemAvatarUrl, setEcosystemAvatarUrl] = useState("");
  const fallbackDisplayName = useMemo(
    () => resolveIdentityDisplayName(metadata, session?.user?.email ?? ""),
    [metadata, session?.user?.email],
  );

  const profileSeed = useMemo(
    () => readKnexchatProfileSeed(session?.user?.id ?? ""),
    [session?.user?.id],
  );

  const membershipEmail = useMemo(() => {
    const fromMembership = String(status?.membership?.knexchat_email ?? "").trim().toLowerCase();
    if (fromMembership) return fromMembership;
    if (queryEmail) return queryEmail;
    return (session?.user?.email ?? "").trim().toLowerCase();
  }, [queryEmail, session?.user?.email, status?.membership?.knexchat_email]);
  const mode = useMemo<Mode>(() => {
    if (queryMode) return queryMode;
    const sessionEmail = (session?.user?.email ?? "").trim().toLowerCase();
    if (membershipEmail && sessionEmail && membershipEmail !== sessionEmail) {
      return "custom";
    }
    return "ecosystem";
  }, [membershipEmail, queryMode, session?.user?.email]);

  const avatarToImport = useMemo(() => {
    if (mode !== "ecosystem") return "";
    if (profileSeed?.avatarUrl) return profileSeed.avatarUrl;
    if (ecosystemAvatarUrl) return ecosystemAvatarUrl;
    return "";
  }, [ecosystemAvatarUrl, mode, profileSeed?.avatarUrl]);

  useEffect(() => {
    setEcosystemAvatarUrl(resolveIdentityAvatarUrl(metadata));
  }, [metadata]);

  useEffect(() => {
    if (!session?.user?.id) return;
    let active = true;
    (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !active) return;
        const freshFromAuth = resolveIdentityAvatarUrl((authData?.user?.user_metadata as IdentityMetadata) ?? null);
        if (freshFromAuth) {
          setEcosystemAvatarUrl(freshFromAuth);
          return;
        }
      } catch {
        // Ignore auth metadata refresh failures.
      }

      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", session.user.id)
          .maybeSingle();
        if (profileError || !active) return;
        const avatarFromProfile = sanitizeAvatarUrl(
          String((profileData as { avatar_url?: string | null } | null)?.avatar_url ?? ""),
        );
        if (avatarFromProfile) {
          setEcosystemAvatarUrl(avatarFromProfile);
        }
      } catch {
        // Ignore profile fallback lookup failures.
      }
    })();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

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
      if (!session?.access_token) throw new Error("unauthorized");
      const headers = new Headers(init.headers ?? {});
      headers.set("Authorization", `Bearer ${session.access_token}`);
      return fetch(input, { ...init, headers });
    },
    [session?.access_token],
  );

  const fetchSuggestions = useCallback(
    async (base?: string) => {
      if (!session?.access_token) return;
      setSuggesting(true);
      try {
        const candidate = String(base ?? handleInput ?? displayName ?? "").trim();
        const res = await authFetch("/api/knexchat/nickname/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base: candidate }),
        });
        const payload = (await res.json().catch(() => null)) as NicknameSuggestPayload | null;
        if (!res.ok || !payload) return;
        const next = Array.isArray(payload.suggestions)
          ? payload.suggestions.filter((item) => typeof item === "string" && item.trim()).slice(0, 3)
          : [];
        setSuggestions(next);
      } catch {
        // Ignore suggestion errors.
      } finally {
        setSuggesting(false);
      }
    },
    [authFetch, displayName, handleInput, session?.access_token],
  );

  useEffect(() => {
    if (!session?.access_token) return;
    let active = true;
    (async () => {
      try {
        const res = await authFetch("/api/knexchat/activation/status");
        const payload = (await res.json().catch(() => null)) as ActivationStatus | null;
        if (!active) return;
        if (res.status === 401) {
          if (hasRedirectedRef.current) return;
          hasRedirectedRef.current = true;
          router.replace(loginHref);
          return;
        }
        if (!res.ok || !payload) {
          setSubmitError("Nao foi possivel carregar os dados de ativacao.");
          return;
        }
        if (!payload.activated) {
          if (hasRedirectedRef.current) return;
          hasRedirectedRef.current = true;
          router.replace(`/knexchat/activate?returnTo=${encodeURIComponent(safeReturnTo)}`);
          return;
        }
        if (payload.profile_completed) {
          if (hasRedirectedRef.current) return;
          hasRedirectedRef.current = true;
          router.replace(safeReturnTo);
          return;
        }
        setStatus(payload);
      } catch {
        if (active) {
          setSubmitError("Nao foi possivel carregar os dados de ativacao.");
        }
      } finally {
        if (active) {
          setStatusLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [authFetch, loginHref, router, safeReturnTo, session?.access_token]);

  useEffect(() => {
    if (initializedRef.current) return;
    if (loading || statusLoading) return;
    if (!session) return;

    const fromProfileName = String(status?.profile?.display_name ?? "").trim();
    const fromSeedName = String(profileSeed?.displayName ?? "").trim();
    const baseDisplayName = fromProfileName || fromSeedName || fallbackDisplayName || "";
    const fromProfileHandle = String(status?.profile?.nickname_normalized ?? status?.profile?.nickname ?? "").trim();
    const baseHandle =
      fromProfileHandle || normalizeNickname(baseDisplayName || (session.user.email ?? "knexchat"));

    setDisplayName(baseDisplayName);
    setHandleInput(baseHandle);
    setAcceptTerms(Boolean(status?.profile?.terms_accepted_at));
    setConfirmAge(Boolean(status?.profile?.terms_accepted_at));
    if (!fromProfileHandle) {
      void fetchSuggestions(baseHandle || baseDisplayName || "knexchat");
    }

    initializedRef.current = true;
  }, [
    fallbackDisplayName,
    fetchSuggestions,
    loading,
    profileSeed?.displayName,
    session,
    status?.profile?.display_name,
    status?.profile?.nickname,
    status?.profile?.nickname_normalized,
    status?.profile?.terms_accepted_at,
    statusLoading,
  ]);

  useEffect(() => {
    if (!session?.access_token) return;
    const trimmed = handleInput.trim();
    if (!trimmed) {
      setHandleHint(null);
      setHandleAvailable(null);
      setHandleChecking(false);
      return;
    }

    const validation = validateNickname(trimmed);
    if (!validation.ok) {
      setHandleHint(getNicknameErrorMessage(validation.error));
      setHandleAvailable(null);
      setHandleChecking(false);
      return;
    }

    setHandleHint(null);
    let active = true;
    const timer = window.setTimeout(async () => {
      setHandleChecking(true);
      try {
        const res = await authFetch(`/api/knexchat/nickname/check?value=${encodeURIComponent(validation.normalized)}`);
        const payload = (await res.json().catch(() => null)) as NicknameCheckPayload | null;
        if (!active) return;
        if (!res.ok || !payload?.ok) {
          setHandleAvailable(null);
          setHandleHint("Nao foi possivel verificar disponibilidade agora.");
          return;
        }
        const available = Boolean(payload.available);
        setHandleAvailable(available);
        setHandleHint(available ? "Usuario disponivel." : "Este @usuario ja esta em uso.");
      } catch {
        if (!active) return;
        setHandleAvailable(null);
        setHandleHint("Nao foi possivel verificar disponibilidade agora.");
      } finally {
        if (active) {
          setHandleChecking(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [authFetch, handleInput, session?.access_token]);

  const handleSubmit = async () => {
    setSubmitError(null);
    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      setSubmitError("Informe o nome de exibicao.");
      return;
    }
    const validation = validateNickname(handleInput);
    if (!validation.ok) {
      setSubmitError(getNicknameErrorMessage(validation.error));
      return;
    }
    if (handleAvailable === false) {
      setSubmitError("Escolha um @usuario disponivel.");
      void fetchSuggestions(validation.normalized);
      return;
    }
    if (!acceptTerms) {
      setSubmitError("Voce precisa aceitar os Termos e Politica de Privacidade.");
      return;
    }
    if (!confirmAge) {
      setSubmitError("Confirme a idade minima para continuar.");
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch("/api/knexchat/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: validation.normalized,
          display_name: normalizedDisplayName,
          accept_terms: true,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
      if (!res.ok) {
        if (payload?.code === "nickname_taken") {
          setHandleAvailable(false);
          setHandleHint("Este @usuario ja esta em uso.");
          void fetchSuggestions(validation.normalized);
        }
        setSubmitError(payload?.message ?? "Nao foi possivel concluir a ativacao.");
        return;
      }

      let finalAvatarToImport = avatarToImport;
      if (mode === "ecosystem" && session?.user?.id && !finalAvatarToImport) {
        try {
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (!authError) {
            finalAvatarToImport = resolveIdentityAvatarUrl((authData?.user?.user_metadata as IdentityMetadata) ?? null);
          }
        } catch {
          // Ignore auth metadata refresh failures.
        }
      }
      if (mode === "ecosystem" && session?.user?.id && !finalAvatarToImport) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", session.user.id)
            .maybeSingle();
          if (!profileError) {
            finalAvatarToImport = sanitizeAvatarUrl(
              String((profileData as { avatar_url?: string | null } | null)?.avatar_url ?? ""),
            );
          }
        } catch {
          // Ignore profile fallback lookup failures.
        }
      }

      if (session?.user?.id && mode === "ecosystem") {
        writeKnexchatProfileSeed(session.user.id, {
          ...(finalAvatarToImport ? { avatarUrl: finalAvatarToImport } : {}),
          displayName: normalizedDisplayName,
          source: "ecosystem",
          createdAt: new Date().toISOString(),
        });
      }

      if (session?.user?.id) {
        try {
          window.localStorage.setItem(
            getKnexchatPreferencesKey(session.user.id),
            JSON.stringify({
              privateAccount,
              discoverByEmail,
              capturedAt: new Date().toISOString(),
            }),
          );
        } catch {
          // Ignore storage write errors.
        }
      }

      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace(safeReturnTo);
    } finally {
      setSaving(false);
    }
  };

  if (loading || statusLoading) {
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
        <h1 className="text-2xl font-semibold">Finalizar ativacao</h1>
        <p className="mt-2 text-sm text-slate-600">
          Etapa 3 de 3. Defina sua identidade no produto e confirme os termos.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="block text-sm font-semibold text-slate-700">E-mail cadastrado</span>
            <input
              value={membershipEmail}
              readOnly
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">Foto inicial do KnexChat</p>
            {mode === "ecosystem" ? (
              avatarToImport ? (
                <div className="mt-2 flex items-center gap-3">
                  <img src={avatarToImport} alt="Avatar do ecossistema" className="h-12 w-12 rounded-xl object-cover" />
                  <p className="text-xs text-slate-600">
                    Vamos usar sua foto atual do ecossistema como imagem inicial do KnexChat.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-600">
                  Seu perfil do ecossistema nao possui imagem no momento. Voce podera adicionar depois dentro do KnexChat.
                </p>
              )
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                Como voce escolheu outro e-mail, a importacao automatica de imagem nao sera aplicada nesta ativacao.
              </p>
            )}
          </div>

          <label className="block">
            <span className="block text-sm font-semibold text-slate-700">Nome de exibicao</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              placeholder="Como voce quer aparecer no KnexChat"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-semibold text-slate-700">Nome de usuario (@handle)</span>
            <div className="mt-1 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="mr-1 text-sm text-slate-500">@</span>
              <input
                value={handleInput.replace(/^@+/, "")}
                onChange={(event) => setHandleInput(event.target.value.replace(/^@+/, ""))}
                className="w-full bg-transparent text-sm text-slate-900 focus:outline-none"
                placeholder="seu_usuario"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </label>

          <div className="text-xs">
            {handleChecking ? <p className="text-slate-500">Verificando disponibilidade...</p> : null}
            {!handleChecking && handleHint ? (
              <p className={handleAvailable === false ? "text-rose-600" : handleAvailable ? "text-emerald-600" : "text-slate-500"}>
                {handleHint}
              </p>
            ) : null}
            <p className="mt-1 text-slate-500">Regras: 3-20 caracteres, letras, numeros, ponto e _.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">Sugestoes de @usuario</p>
              <button
                type="button"
                onClick={() => void fetchSuggestions(handleInput || displayName || "knexchat")}
                disabled={suggesting}
                className="text-xs font-semibold text-blue-700 hover:underline disabled:text-slate-400"
              >
                {suggesting ? "Gerando..." : "Gerar sugestoes"}
              </button>
            </div>
            {suggestions.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setHandleInput(item)}
                    className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    @{item}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Sem sugestoes no momento.</p>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Li e aceito os Termos e Politica de Privacidade do KnexChat.</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={confirmAge}
                onChange={(event) => setConfirmAge(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Confirmo que atendo a idade minima para usar o produto.</span>
            </label>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-700">Preferencias iniciais</p>
            <label className="flex items-center justify-between gap-3">
              <span>Conta privada</span>
              <input
                type="checkbox"
                checked={privateAccount}
                onChange={(event) => setPrivateAccount(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Permitir encontrar por e-mail</span>
              <input
                type="checkbox"
                checked={discoverByEmail}
                onChange={(event) => setDiscoverByEmail(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            2FA, e-mail de recuperacao e controle de dispositivos serao configuraveis em seguida no painel da conta.
          </div>

          {submitError ? <p className="text-sm text-rose-600">{submitError}</p> : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Finalizando..." : "Concluir e entrar no KnexChat"}
          </button>
        </div>
      </div>
    </main>
  );
}
