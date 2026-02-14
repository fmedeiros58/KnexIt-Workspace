"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthScaffold from "../_components/AuthScaffold";
import {
  buildAccessStepHref,
  buildModeFromPurpose,
  getAppBaseUrl,
  getSignupPasswordKey,
  isEmail,
  normalizeEmail,
  resolvePostLoginTarget,
  resolveReturnTo,
} from "../_lib/authFlow";
import { identitySupabase } from "@/lib/identitySupabaseClient";

const supabase = identitySupabase();

type LookupPayload = {
  exists?: boolean;
  hasPassword?: boolean;
  methods?: {
    otp?: boolean;
  };
  twoStepRequired?: boolean;
};

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="currentColor"
      d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2ZM10 7a2 2 0 1 1 4 0v2h-4V7Z"
    />
  </svg>
);

const EyeIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    {open ? (
      <path
        fill="currentColor"
        d="M12 5c5.52 0 9.77 3.61 11 7-1.23 3.39-5.48 7-11 7S2.23 15.39 1 12c1.23-3.39 5.48-7 11-7Zm0 2c-4.38 0-7.86 2.57-9.09 5 1.23 2.43 4.71 5 9.09 5s7.86-2.57 9.09-5c-1.23-2.43-4.71-5-9.09-5Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z"
      />
    ) : (
      <path
        fill="currentColor"
        d="m3.7 2.29 18.01 18.01-1.41 1.41-2.49-2.49A12.4 12.4 0 0 1 12 19c-5.52 0-9.77-3.61-11-7a12.8 12.8 0 0 1 4.28-5.21L2.29 3.7 3.7 2.29ZM7.01 8.43A10.53 10.53 0 0 0 2.91 12c1.23 2.43 4.71 5 9.09 5 1.61 0 3.08-.35 4.37-.89l-2.18-2.18a3.5 3.5 0 0 1-4.12-4.12L7.01 8.43Zm4.91-1.31c.03-.04.05-.08.08-.12 4.38 0 7.86 2.57 9.09 5-.43.84-1.11 1.73-1.99 2.54l-1.45-1.45c.21-.35.35-.72.44-1.09a2.5 2.5 0 0 0-2.98-2.98c-.37.09-.74.23-1.09.44l-2.1-2.1Z"
      />
    )}
  </svg>
);

export default function SenhaStepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = useMemo(() => normalizeEmail(searchParams.get("email") ?? ""), [searchParams]);

  const appBaseUrl = useMemo(() => getAppBaseUrl(), []);
  const returnTo = useMemo(() => resolveReturnTo(searchParams, appBaseUrl), [appBaseUrl, searchParams]);

  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(searchParams.get("exists") === "1");
  const [hasPassword, setHasPassword] = useState(searchParams.get("hasPassword") === "1");
  const [twoStepRequired, setTwoStepRequired] = useState(searchParams.get("twoStep") === "1");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshLookup = useCallback(async () => {
    if (!isEmail(email)) {
      router.replace(buildAccessStepHref("email", searchParams));
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/lookup-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "Falha ao validar o e-mail.");
      return;
    }

    const payload = (await res.json().catch(() => ({}))) as LookupPayload;
    const existsFromLookup = Boolean(payload.exists);
    setExists(existsFromLookup);
    setHasPassword(Boolean(payload.hasPassword));
    setTwoStepRequired(Boolean(payload.twoStepRequired));
  }, [email, router, searchParams]);

  useEffect(() => {
    void refreshLookup();
  }, [refreshLookup]);

  const finalizeLogin = useCallback(
    async (source: "password" | "otp") => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data?.session) {
        setError("Nao foi possivel autenticar. Tente novamente.");
        return;
      }

      const target = await resolvePostLoginTarget(returnTo, data.session.access_token);
      console.info("[auth] login_success", { source, target });
      router.replace(target);
    },
    [returnTo, router],
  );

  const goToCode = useCallback(
    (purpose: "login" | "signup" | "recovery", sent = false) => {
      router.push(
        buildAccessStepHref("codigo", searchParams, {
          email,
          purpose,
          sent: sent ? "1" : undefined,
        }),
      );
    },
    [email, router, searchParams],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!isEmail(email)) {
      setError("Informe um e-mail valido.");
      return;
    }
    if (!password) {
      setError("Informe sua senha.");
      return;
    }

    if (exists) {
      setSubmitting(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setSubmitting(false);

      if (signInError) {
        if (/invalid login credentials/i.test(signInError.message ?? "")) {
          setError("Senha invalida. Use codigo por e-mail se preferir.");
        } else {
          setError(signInError.message ?? "Nao foi possivel fazer login.");
        }
        return;
      }

      if (twoStepRequired) {
        await supabase.auth.signOut();
        const otpRes = await fetch("/api/auth/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            purpose: "login",
            mode: buildModeFromPurpose("login"),
          }),
        });
        if (!otpRes.ok) {
          const payload = (await otpRes.json().catch(() => ({}))) as { message?: string };
          setError(payload.message ?? "Falha ao enviar codigo.");
          return;
        }
        setNotice("Codigo de 6 digitos enviado para seu e-mail.");
        goToCode("login", true);
        return;
      }

      await finalizeLogin("password");
      return;
    }

    if (!confirmPassword) {
      setError("Confirme sua senha.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas nao coincidem.");
      return;
    }
    if (!acceptTerms) {
      setError("Voce precisa aceitar os termos para continuar.");
      return;
    }

    if (twoStepRequired) {
      setSubmitting(true);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(getSignupPasswordKey(email), password);
      }

      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          purpose: "signup",
          mode: buildModeFromPurpose("signup"),
          password,
        }),
      });

      setSubmitting(false);

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        setError(payload.message ?? "Falha ao enviar codigo.");
        return;
      }

      setNotice("Codigo enviado para seu e-mail.");
      goToCode("signup", true);
      return;
    }

    setSubmitting(true);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setSubmitting(false);
      setError(signUpError.message ?? "Nao foi possivel criar sua conta.");
      return;
    }

    if (!signUpData?.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setSubmitting(false);
      if (signInError) {
        setNotice("Conta criada. Verifique seu e-mail para confirmar o acesso.");
        return;
      }
      await finalizeLogin("password");
      return;
    }

    setSubmitting(false);
    await finalizeLogin("password");
  };

  const title = exists ? "Entrar com senha" : "Crie sua senha";
  const actionLabel = exists ? "Fazer login" : "Criar conta";

  return (
    <AuthScaffold>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="w-full text-center">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">Conta: {email}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Acesso</span>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <span>Metodo por senha</span>
        <button
          type="button"
          onClick={() => router.push(buildAccessStepHref("email", searchParams, { email }))}
          className="font-semibold text-blue-700 hover:underline"
        >
          Alterar e-mail
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-600">Validando conta...</p> : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      {!loading ? (
        <form onSubmit={onSubmit} className="space-y-3 rounded-2xl bg-slate-100/70 p-4">
          <label className="block text-sm text-slate-700">
            <span className="sr-only">Senha</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <LockIcon />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={exists ? "current-password" : "new-password"}
                className="w-full rounded-xl border border-slate-300 bg-[#e8eef8] py-3 pl-9 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder="Digite sua senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </label>

          {!exists ? (
            <label className="block text-sm text-slate-700">
              <span className="sr-only">Confirmar senha</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <LockIcon />
                </span>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-300 bg-[#e8eef8] py-3 pl-9 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  placeholder="Confirmar senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                  aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </label>
          ) : null}

          {!exists ? (
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                className="mt-0.5"
              />
              Concordo com os Termos de Servico e Politica de Privacidade.
            </label>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#0f5bd6] px-4 py-3 text-center text-sm font-semibold leading-snug text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Processando..." : actionLabel}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => goToCode(exists ? "login" : "signup")}
              className="font-semibold text-blue-700 hover:underline"
            >
              Usar codigo por e-mail
            </button>
            {exists ? (
              <button type="button" onClick={() => goToCode("recovery")} className="font-semibold text-blue-700 hover:underline">
                Esqueci minha senha
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </AuthScaffold>
  );
}
