"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type OtpPurpose,
} from "../_lib/authFlow";
import { identitySupabase } from "@/lib/identitySupabaseClient";

const supabase = identitySupabase();
const OTP_REGEX = /^\d{6}$/;

const isOtpPurpose = (value: string | null): value is OtpPurpose => {
  return value === "login" || value === "signup" || value === "recovery" || value === "oauth_verify";
};

export default function CodigoStepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = useMemo(() => normalizeEmail(searchParams.get("email") ?? ""), [searchParams]);
  const purpose: OtpPurpose = isOtpPurpose(searchParams.get("purpose")) ? (searchParams.get("purpose") as OtpPurpose) : "login";
  const sentFromQuery = searchParams.get("sent") === "1";

  const appBaseUrl = useMemo(() => getAppBaseUrl(), []);
  const returnTo = useMemo(() => resolveReturnTo(searchParams, appBaseUrl), [appBaseUrl, searchParams]);

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(sentFromQuery);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    sentFromQuery ? "Codigo enviado para seu e-mail." : null,
  );

  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const sentOnceRef = useRef(false);
  const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const readSignupPassword = useCallback(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(getSignupPasswordKey(email)) ?? "";
  }, [email]);

  const clearSignupPassword = useCallback(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(getSignupPasswordKey(email));
  }, [email]);

  const finalizeLogin = useCallback(
    async (source: "otp" | "recovery") => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data?.session) {
        setError("Nao foi possivel autenticar. Tente novamente.");
        return;
      }

      const target = await resolvePostLoginTarget(returnTo, data.session.access_token);
      console.info("[auth] login_success", { source, target, purpose });
      router.replace(target);
    },
    [purpose, returnTo, router],
  );

  const sendCode = useCallback(async () => {
    if (!isEmail(email)) {
      setError("Informe um e-mail valido.");
      return;
    }

    const signupPassword = purpose === "signup" ? readSignupPassword() : "";
    if (purpose === "signup" && !signupPassword) {
      setError("Defina sua senha antes de pedir o codigo.");
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);

    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        purpose,
        mode: buildModeFromPurpose(purpose),
        ...(purpose === "signup" ? { password: signupPassword } : {}),
      }),
    });

    setSending(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "Falha ao enviar codigo.");
      return;
    }

    setOtpSent(true);
    setNotice("Codigo de 6 digitos enviado para seu e-mail.");
    setResendCooldown(30);
  }, [email, purpose, readSignupPassword]);

  useEffect(() => {
    if (!isEmail(email)) {
      router.replace(buildAccessStepHref("email", searchParams));
      return;
    }

    if (sentOnceRef.current) return;
    sentOnceRef.current = true;

    if (sentFromQuery) {
      setOtpSent(true);
      return;
    }

    void sendCode();
  }, [email, router, searchParams, sendCode, sentFromQuery]);

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const otpDigits = useMemo(() => Array.from({ length: 6 }, (_, index) => otpCode[index] ?? ""), [otpCode]);

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

  const verifyCode = async () => {
    setError(null);
    setNotice(null);

    if (!isEmail(email)) {
      setError("Informe um e-mail valido.");
      return;
    }
    if (!OTP_REGEX.test(otpCode)) {
      setError("Informe o codigo de 6 digitos.");
      return;
    }

    const signupPassword = purpose === "signup" ? readSignupPassword() : "";
    if (purpose === "signup" && !signupPassword) {
      setError("Defina sua senha antes de validar o codigo.");
      return;
    }

    setVerifying(true);

    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        code: otpCode,
        token: otpCode,
        purpose,
        mode: buildModeFromPurpose(purpose),
        ...(purpose === "signup" ? { password: signupPassword } : {}),
      }),
    });

    const payload = (await res.json().catch(() => ({}))) as {
      message?: string;
      session?: { access_token?: string; refresh_token?: string };
    };

    setVerifying(false);

    if (!res.ok) {
      setError(payload.message ?? "Falha ao validar codigo.");
      return;
    }

    if (payload.session?.access_token && payload.session?.refresh_token) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (setSessionError) {
        setError("Nao foi possivel abrir a sessao.");
        return;
      }
    }

    if (purpose === "signup") {
      clearSignupPassword();
    }

    if (purpose === "recovery") {
      setRecoveryVerified(true);
      setNotice("Codigo confirmado. Defina sua nova senha.");
      return;
    }

    await finalizeLogin("otp");
  };

  const updatePassword = async () => {
    setError(null);
    setNotice(null);

    if (!recoveryVerified) {
      setError("Valide o codigo antes de alterar a senha.");
      return;
    }
    if (!newPassword || !newPasswordConfirm) {
      setError("Informe e confirme a nova senha.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("As senhas nao coincidem.");
      return;
    }

    setUpdatingPassword(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);

    if (updateError) {
      setError(updateError.message ?? "Falha ao atualizar senha.");
      return;
    }

    await finalizeLogin("recovery");
  };

  const backToPassword = () => {
    router.push(buildAccessStepHref("senha", searchParams, { email }));
  };

  const purposeLabel =
    purpose === "signup"
      ? "Confirmar criacao da conta"
      : purpose === "recovery"
        ? "Recuperar senha"
        : purpose === "oauth_verify"
          ? "Confirmar acesso"
          : "Entrar com codigo";
  const actionLabel =
    purpose === "signup"
      ? "Autenticar"
      : purpose === "recovery"
        ? "Confirmar codigo"
        : purpose === "oauth_verify"
          ? "Autenticar"
          : "Fazer login";

  return (
    <AuthScaffold>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="w-full text-center">
          <h2 className="text-lg font-semibold text-slate-900">{purposeLabel}</h2>
          <p className="mt-2 text-sm text-slate-600">Conta: {email}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">OTP</span>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="space-y-4 rounded-2xl bg-slate-100/70 p-4">
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
              className="h-12 w-full rounded-xl border border-slate-300 bg-white text-center text-lg font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              aria-label={`Digito ${index + 1}`}
            />
          ))}
        </div>

        {!recoveryVerified ? (
          <button
            type="button"
            onClick={verifyCode}
            disabled={verifying || otpCode.length !== 6}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#0f5bd6] px-4 py-3 text-center text-sm font-semibold leading-snug text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? "Validando..." : actionLabel}
          </button>
        ) : null}

        {purpose === "recovery" && recoveryVerified ? (
          <div className="space-y-3">
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Nova senha"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
            />
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(event) => setNewPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder="Confirmar nova senha"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={updatePassword}
              disabled={updatingPassword}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#0f5bd6] px-4 py-3 text-center text-sm font-semibold leading-snug text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updatingPassword ? "Salvando..." : "Atualizar senha"}
            </button>
          </div>
        ) : null}

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              if (resendCooldown > 0 || sending) return;
              void sendCode();
            }}
            disabled={resendCooldown > 0 || sending}
            className="font-semibold text-blue-700 hover:underline disabled:text-slate-400"
          >
            {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : sending ? "Enviando..." : "Reenviar codigo"}
          </button>

          <button type="button" onClick={backToPassword} className="font-semibold text-blue-700 hover:underline">
            Voltar
          </button>
        </div>
      </div>

      {!otpSent ? <p className="text-xs text-slate-500">Aguardando envio do codigo...</p> : null}
    </AuthScaffold>
  );
}
