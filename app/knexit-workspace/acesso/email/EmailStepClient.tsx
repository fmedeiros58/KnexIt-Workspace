"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthScaffold from "../_components/AuthScaffold";
import AccessFlowGuide from "../_components/AccessFlowGuide";
import {
  buildModeFromPurpose,
  getAppBaseUrl,
  isEmail,
  normalizeEmail,
  resolvePostLoginTarget,
  resolveReturnTo,
  type OtpPurpose,
} from "../_lib/authFlow";
import { identitySupabase } from "@/lib/identitySupabaseClient";

const supabase = identitySupabase();
const OTP_REGEX = /^\d{6}$/;

type LookupPayload = {
  exists?: boolean;
  hasPassword?: boolean;
  twoStepRequired?: boolean;
};

type Phase = "email" | "password" | "otp";
type OAuthProvider = "google" | "azure" | "facebook";

export default function EmailStepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appBaseUrl = useMemo(() => getAppBaseUrl(), []);
  const returnTo = useMemo(() => resolveReturnTo(searchParams, appBaseUrl), [appBaseUrl, searchParams]);

  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [exists, setExists] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [twoStepRequired, setTwoStepRequired] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [pendingPurpose, setPendingPurpose] = useState<OtpPurpose | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [activePillLabel, setActivePillLabel] = useState<string | null>(null);

  const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const oauthBootstrapRef = useRef(false);

  const normalizedEmail = normalizeEmail(email);
  const emailFormatValid = isEmail(normalizedEmail);
  const isSignupFlow = !exists;

  const guideStep: 1 | 2 | 3 = phase === "email" ? 1 : phase === "password" ? 2 : 3;
  const guideNextStep =
    phase === "email"
      ? "Na próxima etapa você informa sua senha ou cria uma nova senha."
      : phase === "password"
        ? isSignupFlow
          ? "Clique em enviar código para confirmar o e-mail e concluir a criação da conta."
          : twoStepRequired
            ? "Depois da senha válida, enviaremos o código de 6 dígitos para concluir o login."
            : "Depois da senha válida, o acesso será liberado na hora."
        : pendingPurpose === "signup"
          ? "Digite o código recebido e clique em Criar conta."
          : pendingPurpose === "oauth_verify"
            ? "Digite o código recebido e clique em Autenticar."
            : "Digite o código recebido e clique em Fazer login.";

  const finalizeLogin = async (source: "password" | "otp") => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data?.session) {
      setError("Não foi possível autenticar. Tente novamente.");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("oauthPending");
      window.localStorage.removeItem("oauthPendingEmail");
    }
    const target = await resolvePostLoginTarget(returnTo, data.session.access_token);
    console.info("[auth] login_success", { source, target });
    router.replace(target);
  };

  const requestOtp = async (purpose: OtpPurpose, emailOverride?: string) => {
    const requestEmail = normalizeEmail(emailOverride ?? normalizedEmail);
    if (!isEmail(requestEmail)) {
      setError("Informe um e-mail valido.");
      return false;
    }
    setLoading(true);
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: requestEmail,
        purpose,
        mode: buildModeFromPurpose(purpose),
        ...(purpose === "signup" ? { password } : {}),
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "Falha ao enviar código.");
      return false;
    }
    setEmail(requestEmail);
    setPendingPurpose(purpose);
    setPhase("otp");
    setNotice("Código de 6 dígitos enviado para seu e-mail.");
    setResendCooldown(30);
    return true;
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setError(null);
    setNotice(null);
    setOauthLoading(provider);

    const redirectTo = process.env.IDENTITY_AUTH_REDIRECT_URL?.trim() || `${appBaseUrl}/auth/callback`;

    if (typeof window !== "undefined") {
      window.localStorage.setItem("postAuthRedirect", returnTo);
      window.localStorage.setItem("oauthEntryPath", "/knexit-workspace/acesso/email");
      window.localStorage.setItem("oauthReturnTo", returnTo);
      window.localStorage.setItem("oauthPending", "1");
      if (emailFormatValid) {
        window.localStorage.setItem("oauthPendingEmail", normalizedEmail);
      }
    }

    const scopes =
      provider === "google"
        ? "openid email profile"
        : provider === "facebook"
          ? "email public_profile"
          : "openid email profile";

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        scopes,
      },
    });

    if (oauthError || !data?.url) {
      setOauthLoading(null);
      setError(oauthError?.message ?? "Não foi possível iniciar login social.");
      return;
    }

    window.location.assign(data.url);
  };

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!emailFormatValid) {
      setError("Informe um e-mail valido.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/lookup-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    setLoading(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "Falha ao validar o e-mail.");
      return;
    }

    const payload = (await res.json().catch(() => ({}))) as LookupPayload;
    setExists(Boolean(payload.exists));
    setHasPassword(Boolean(payload.hasPassword));
    setTwoStepRequired(Boolean(payload.twoStepRequired));
    setPassword("");
    setConfirmPassword("");
    setOtpCode("");
    setPendingPurpose(null);
    setPhase("password");
  };

  const handlePasswordStep = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!password) {
      setError("Informe sua senha.");
      return;
    }

    if (exists) {
      if (!hasPassword) {
        setError("Esta conta ainda não tem senha. Use a recuperação por código.");
        return;
      }

      setLoading(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      setLoading(false);

      if (signInError) {
        if (/invalid login credentials/i.test(signInError.message ?? "")) {
          setError("Senha invalida.");
        } else {
          setError(signInError.message ?? "Não foi possível fazer login.");
        }
        return;
      }

      if (twoStepRequired) {
        await supabase.auth.signOut();
        await requestOtp("login");
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
      setError("As senhas não coincidem.");
      return;
    }
    if (!acceptTerms) {
      setError("Voce precisa aceitar os termos para continuar.");
      return;
    }

    await requestOtp("signup");
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setNotice(null);

    if (!pendingPurpose) {
      setError("Fluxo de código inválido.");
      return;
    }
    if (!OTP_REGEX.test(otpCode)) {
      setError("Informe o código de 6 dígitos.");
      return;
    }
    if (pendingPurpose === "signup" && !password) {
      setError("Defina a senha antes de confirmar o código.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        code: otpCode,
        token: otpCode,
        purpose: pendingPurpose,
        mode: buildModeFromPurpose(pendingPurpose),
        ...(pendingPurpose === "signup" ? { password } : {}),
      }),
    });
    setLoading(false);

    const payload = (await res.json().catch(() => ({}))) as {
      message?: string;
      session?: { access_token?: string; refresh_token?: string };
    };

    if (!res.ok) {
      setError(payload.message ?? "Falha ao validar código.");
      return;
    }

    if (payload.session?.access_token && payload.session?.refresh_token) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (setSessionError) {
        setError("Não foi possível abrir a sessão.");
        return;
      }
    }

    await finalizeLogin("otp");
  };

  const resendOtp = async () => {
    if (!pendingPurpose || resendCooldown > 0 || loading) return;
    await requestOtp(pendingPurpose);
  };

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (searchParams.get("verify") !== "oauth") return;
    if (oauthBootstrapRef.current) return;
    oauthBootstrapRef.current = true;

    let cancelled = false;

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;

      const oauthEmailFromStorage =
        typeof window !== "undefined" ? window.localStorage.getItem("oauthPendingEmail") ?? "" : "";
      const oauthEmail = normalizeEmail(data.user?.email ?? oauthEmailFromStorage);

      if (!isEmail(oauthEmail)) {
        setError("Não foi possível identificar o e-mail da conta.");
        return;
      }

      setExists(true);
      setHasPassword(false);
      setTwoStepRequired(true);
      await requestOtp("oauth_verify", oauthEmail);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [requestOtp, searchParams]);

  const otpDigits = Array.from({ length: 6 }, (_, index) => otpCode[index] ?? "");
  const otpActionLabel =
    pendingPurpose === "signup" ? "Criar conta" : pendingPurpose === "oauth_verify" ? "Autenticar" : "Fazer login";

  const handleOtpChange =
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const digit = event.target.value.replace(/\D/g, "").slice(-1);
      const next = otpDigits.slice();
      next[index] = digit;
      const joined = next.join("").slice(0, 6);
      setOtpCode(joined);
      if (digit && index < 5) {
        otpInputsRef.current[index + 1]?.focus();
      }
    };

  const handleOtpKeyDown =
    (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Backspace") return;
      if (otpDigits[index]) return;
      if (index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData("text");
    const digits = text.replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    event.preventDefault();
    setOtpCode(digits);
    const nextIndex = Math.min(digits.length, 5);
    otpInputsRef.current[nextIndex]?.focus();
  };

  return (
    <AuthScaffold>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="w-full text-center">
          <h2 className="text-lg font-semibold text-slate-900">Entrar ou criar conta</h2>
          <p className="mt-2 text-sm text-[var(--kx-secondary)]">Fluxo contínuo na mesma tela.</p>
        </div>
        <span className="rounded-full bg-[rgba(38,107,217,0.12)] px-3 py-1 text-xs font-semibold text-[var(--kx-primary)]">
          Acesso
        </span>
      </div>

      <AccessFlowGuide step={guideStep} nextStep={guideNextStep} activeLabel={activePillLabel ?? undefined} />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}

      {phase === "email" ? (
        <form onSubmit={handleLookup} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            <span className="sr-only">E-mail</span>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                E-mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onFocus={() => setActivePillLabel("Insira o e-mail")}
                onBlur={() => setActivePillLabel(null)}
                autoComplete="email"
                inputMode="email"
                className={`w-full rounded-xl border bg-white py-3 pl-20 pr-4 text-sm outline-none focus:ring-2 ${
                  !email
                    ? "border-slate-300 focus:border-[color:var(--kx-focus)] focus:ring-[rgba(42,93,172,0.2)]"
                    : emailFormatValid
                      ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100"
                      : "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                }`}
                required
              />
            </div>
          </label>
          {email ? (
            <p className={`text-xs ${emailFormatValid ? "text-emerald-700" : "text-rose-700"}`}>
              {emailFormatValid ? "E-mail reconhecido. Clique em continuar." : "Formato de e-mail inválido."}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !email}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[var(--kx-primary)] px-4 py-3 text-center text-sm font-semibold leading-snug text-white shadow-lg shadow-blue-500/20 hover:bg-[var(--kx-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verificando..." : "Continuar"}
          </button>
        </form>
      ) : null}

      {phase === "password" ? (
        <form onSubmit={handlePasswordStep} className="space-y-4 rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <span>{exists ? `Conta encontrada: ${normalizedEmail}` : `Novo e-mail: ${normalizedEmail}`}</span>
            <button
              type="button"
              onClick={() => {
                setPhase("email");
                setError(null);
                setNotice(null);
              }}
              className="font-semibold text-blue-700 hover:underline"
            >
              Alterar e-mail
            </button>
          </div>

          <label className="block text-sm text-slate-700">
            <span>{exists ? "Senha" : "Criar senha"}</span>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={exists ? "current-password" : "new-password"}
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                placeholder={exists ? "Digite sua senha" : "Crie sua senha"}
                required
                onFocus={() => setActivePillLabel("Insira sua senha")}
                onBlur={() => setActivePillLabel(null)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>

          {!exists ? (
            <label className="block text-sm text-slate-700">
              <span>Confirmar senha</span>
              <div className="relative mt-2">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  placeholder="Confirme sua senha"
                  required
                  onFocus={() => setActivePillLabel("Confirme sua senha")}
                  onBlur={() => setActivePillLabel(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500"
                  aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showConfirmPassword ? "Ocultar" : "Mostrar"}
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
            disabled={loading}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[var(--kx-primary)] px-4 py-3 text-center text-sm font-semibold leading-snug text-white hover:bg-[var(--kx-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Processando..."
              : exists
                ? twoStepRequired
                  ? "Enviar código de confirmação"
                  : "Fazer login"
                : "Enviar código de confirmação"}
          </button>
        </form>
      ) : null}

      {phase === "otp" ? (
        <div className="space-y-4 rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <span>Código para: {normalizedEmail}</span>
            <button
              type="button"
              onClick={() => {
                setPhase("password");
                setOtpCode("");
              }}
              className="font-semibold text-blue-700 hover:underline"
            >
              Voltar para senha
            </button>
          </div>

          <div onPaste={handleOtpPaste} className="grid grid-cols-6 gap-2">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(node) => {
                  otpInputsRef.current[index] = node;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={handleOtpChange(index)}
                onKeyDown={handleOtpKeyDown(index)}
                onFocus={() => setActivePillLabel("Digite o código")}
                onBlur={() => setActivePillLabel(null)}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white text-center text-lg font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                aria-label={`Digito ${index + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={loading || otpCode.length !== 6}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[var(--kx-primary)] px-4 py-3 text-center text-sm font-semibold leading-snug text-white hover:bg-[var(--kx-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Validando..." : otpActionLabel}
          </button>

          <button
            type="button"
            onClick={resendOtp}
            disabled={resendCooldown > 0 || loading}
            className="w-full text-center text-xs font-semibold text-blue-700 hover:underline disabled:text-slate-400"
          >
            {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
          </button>
        </div>
      ) : null}
    </AuthScaffold>
  );
}
