"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_PRODUCT_SLUG, getProduct, ProductEntry, ProductSlug } from "@/lib/products";

type LoginPageClientProps = {
  productSlug?: ProductSlug | null;
  initialFrom?: string | null;
  initialProduct?: string | null;
  initialRedirect?: string | null;
  oauthRedirectUrl?: string | null;
};

const DEFAULT_PRODUCT = getProduct(DEFAULT_PRODUCT_SLUG)!;
const supabase = identitySupabase();
const normalizeAllowedDomain = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

const getAppBaseUrl = () => {
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envBase) return normalizeBaseUrl(envBase);
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin);
  }
  return "https://knexspace.com";
};

const isWebViewEnvironment = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  return (
    (isAndroid && /wv|Version\/\d+/.test(ua)) ||
    (isIos && !/Safari/i.test(ua)) ||
    /FBAN|FBAV|Instagram|Line|Twitter|Snapchat|TikTok|WhatsApp/i.test(ua)
  );
};

function normalizeRedirect(product: ProductEntry, target: string | null, origin: string) {
  if (!target) return target;
  try {
    const url = new URL(target, origin || "http://localhost");
    const path = url.pathname;
    if (path === `/${product.slug}` || path === `/lobby/${product.slug}`) {
      url.pathname = product.homePath;
      url.search = "";
    }
    return url.toString();
  } catch {
    if (target === `/${product.slug}` || target.startsWith(`/lobby/${product.slug}`)) {
      return product.homePath;
    }
    return target;
  }
}

export default function LoginPageClient({
  productSlug,
  initialFrom = null,
  initialProduct = null,
  initialRedirect = null,
  oauthRedirectUrl = null,
}: LoginPageClientProps) {
  const router = useRouter();
  const appBaseUrl = useMemo(() => getAppBaseUrl(), []);
  const isWebView = useMemo(() => isWebViewEnvironment(), []);
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<"login" | "signup" | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const allowedDomain = normalizeAllowedDomain(process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || "");

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isAllowedEmail = useCallback(
    (email?: string | null) => {
      if (!email) return false;
      const lowered = email.toLowerCase();
      if (!allowedDomain) return true;
      return lowered.endsWith(`@${allowedDomain}`);
    },
    [allowedDomain],
  );

  const { targetRedirect, productLabel, activeProductSlug, hasExplicitProduct } = useMemo(() => {
    const resolveTarget = (value: string | null | undefined, base: string): string | null => {
      if (!value) return null;
      try {
        return new URL(value, base || "http://localhost").toString();
      } catch {
        return value;
      }
    };

    const fromParam = initialFrom || initialRedirect;
    const searchSlug = initialProduct;
    const requestedSlug = productSlug?.toLowerCase() ?? searchSlug?.toLowerCase();
    const resolvedProduct = getProduct(requestedSlug) ?? DEFAULT_PRODUCT;
    const hasExplicitProduct = Boolean(productSlug || searchSlug || fromParam);
    const origin = typeof window !== "undefined" ? window.location.origin : appBaseUrl;

    const targetRaw =
      resolveTarget(fromParam, origin) ||
      resolveTarget(resolvedProduct.homePath, origin) ||
      resolvedProduct.homePath;

    const target = normalizeRedirect(resolvedProduct, targetRaw, origin);

    return {
      targetRedirect: target,
      productLabel: resolvedProduct.name,
      activeProductSlug: resolvedProduct.slug,
      hasExplicitProduct,
    };
  }, [productSlug, initialFrom, initialProduct, initialRedirect, appBaseUrl]);

  const postAuthRedirect = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : appBaseUrl;
    if (!targetRedirect) return undefined;
    try {
      return new URL(targetRedirect, base).toString();
    } catch {
      return targetRedirect;
    }
  }, [targetRedirect, appBaseUrl]);

  const oauthRedirect = useMemo(() => {
    const base = appBaseUrl || "https://knexspace.com";
    const safeBase = normalizeBaseUrl(base);
    const fallback = `${safeBase}/auth/callback`;
    if (oauthRedirectUrl) {
      try {
        const url = new URL(oauthRedirectUrl, safeBase);
        if (url.origin === new URL(safeBase).origin) {
          return url.toString();
        }
      } catch {
        // ignore
      }
    }
    const url = new URL(fallback);
    if (targetRedirect) {
      url.searchParams.set("returnTo", targetRedirect);
    }
    return url.toString();
  }, [appBaseUrl, oauthRedirectUrl, targetRedirect]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && typeof window !== "undefined") {
        const email = session?.user?.email ?? null;
        if (email && !isAllowedEmail(email)) {
          setErr("E-mail não autorizado para acessar o Knexit Workspace.");
          await supabase.auth.signOut();
          return;
        }
        const to = localStorage.getItem("postAuthRedirect") || postAuthRedirect || targetRedirect;
        localStorage.removeItem("postAuthRedirect");
        if (to) {
          router.push(to);
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [postAuthRedirect, targetRedirect, router, isAllowedEmail]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user && typeof window !== "undefined") {
        if (!isAllowedEmail(user.email)) {
          setErr("E-mail não autorizado para acessar o Knexit Workspace.");
          await supabase.auth.signOut();
          return;
        }
        const to = localStorage.getItem("postAuthRedirect") || postAuthRedirect || targetRedirect;
        localStorage.removeItem("postAuthRedirect");
        if (to) {
          router.replace(to);
        }
      }
    })();
  }, [postAuthRedirect, targetRedirect, router, isAllowedEmail]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = hasExplicitProduct && productLabel ? `KNEXIT | Login - ${productLabel}` : "KNEXIT | Login";
    }
  }, [productLabel, hasExplicitProduct]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hint = localStorage.getItem("loginEmailHint");
    if (hint) {
      setLoginEmail((prev) => prev || hint);
      localStorage.removeItem("loginEmailHint");
    }
  }, []);

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    setOtpPurpose(null);
    setOtpSent(false);
    setOtpCode("");
  }, [isSignup]);

  async function handleRequestCode(
    e?: React.SyntheticEvent,
    purposeOverride?: "login" | "signup",
  ) {
    e?.preventDefault();
    setErr(null);
    const email = loginEmail.trim().toLowerCase();
    if (!isAllowedEmail(email)) {
      setErr("E-mail não autorizado para acessar o Knexit Workspace.");
      return;
    }
    const purpose = purposeOverride ?? otpPurpose ?? "login";
    if (purpose === "signup" && !password) {
      setErr("Informe sua senha para criar a conta.");
      return;
    }
    setOtpLoading(true);
    if (typeof window !== "undefined" && postAuthRedirect) {
      localStorage.setItem("postAuthRedirect", postAuthRedirect);
    }
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        purpose,
        mode: purpose === "signup" ? "otp_signup" : "otp_login",
        ...(purpose === "signup" ? { password } : {}),
      }),
    });
    setOtpLoading(false);
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setErr(payload?.message ?? "Falha ao enviar código.");
      return;
    }
    setOtpPurpose(purpose);
    setOtpSent(true);
    setOtpCode("");
    setResendCooldown(30);
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      setErr("Informe seu e-mail.");
      return;
    }
    if (!/^\d{6}$/.test(otpCode)) {
      setErr("Codigo invalido. Use 6 digitos.");
      return;
    }
    const purpose = otpPurpose ?? "login";
    if (purpose === "signup" && !password) {
      setErr("Informe sua senha para criar a conta.");
      return;
    }
    setVerifyLoading(true);
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        token: otpCode,
        purpose,
        mode: purpose === "signup" ? "otp_signup" : "otp_login",
        ...(purpose === "signup" ? { password } : {}),
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      message?: string;
      session?: { access_token?: string; refresh_token?: string };
    };
    setVerifyLoading(false);
    if (!res.ok) {
      setErr(payload?.message ?? "Falha ao validar código.");
      return;
    }
    if (payload?.session?.access_token && payload?.session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
    }
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      setErr("Não foi possível autenticar. Tente novamente.");
      return;
    }
    const to = localStorage.getItem("postAuthRedirect") || postAuthRedirect || targetRedirect;
    localStorage.removeItem("postAuthRedirect");
    if (to) router.replace(to);
  }

  async function handlePasswordAuth(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    const email = loginEmail.trim().toLowerCase();
    if (!isAllowedEmail(email)) {
      setErr("E-mail não autorizado para acessar o Knexit Workspace.");
      return;
    }
    if (!password) {
      setErr("Informe sua senha.");
      return;
    }
    setPasswordLoading(true);
    if (typeof window !== "undefined" && postAuthRedirect) {
      localStorage.setItem("postAuthRedirect", postAuthRedirect);
    }
    if (isSignup) {
      setPasswordLoading(false);
      await handleRequestCode(e, "signup");
      setNotice("Enviamos um código de 6 dígitos para confirmar sua conta.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPasswordLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const to = localStorage.getItem("postAuthRedirect") || postAuthRedirect || targetRedirect;
    localStorage.removeItem("postAuthRedirect");
    if (to) router.replace(to);
  }

  async function handleOAuth(provider: "google" | "facebook") {
    setErr(null);
    setNotice(null);
    if (typeof window !== "undefined" && postAuthRedirect) {
      localStorage.setItem("postAuthRedirect", postAuthRedirect);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("oauthEntryPath", "/knexit-workspace/acesso");
      localStorage.setItem("oauthReturnTo", postAuthRedirect || targetRedirect || "");
      localStorage.setItem("oauthPending", provider);
      if (loginEmail) {
        localStorage.setItem("oauthPendingEmail", loginEmail.trim().toLowerCase());
      }
    }
    if (isWebView) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: oauthRedirect, skipBrowserRedirect: true },
      });
      if (error) {
        setErr(error.message);
        return;
      }
      if (data?.url && typeof window !== "undefined") {
        const opened = window.open(data.url, "_blank", "noopener,noreferrer");
        if (!opened) {
          window.location.href = data.url;
        }
        return;
      }
      setErr("Não foi possível iniciar o login.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: oauthRedirect,
      },
    });
    if (error) {
      setErr(error.message);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
      <header className="w-full border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-blue-600" aria-hidden />
            <span className="text-lg font-semibold tracking-tight text-blue-700">Knexit Workspace</span>
          </div>
          <div className="text-xs md:text-sm text-neutral-600">
            {hasExplicitProduct ? (
              <>
                Você será direcionado para <strong>{productLabel}</strong> após entrar.
              </>
            ) : (
              <>Você será direcionado após entrar.</>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-5xl px-4 py-10">
          {err && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {err}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded bg-neutral-900" aria-hidden />
                  <div>
                    <h2 className="text-lg font-semibold">Entrar com senha</h2>
                    <p className="text-sm text-neutral-500">Use seu e-mail e senha do Knexspace.</p>
                  </div>
                </div>

                <form onSubmit={handlePasswordAuth} className="space-y-3">
                  <label className="text-sm block">
                    <span className="mb-1 block text-neutral-700">E-mail</span>
                    <input
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600/30"
                      placeholder="seu@email.com"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                    />
                  </label>
                  <label className="text-sm block">
                    <span className="mb-1 block text-neutral-700">Senha</span>
                    <input
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600/30"
                      placeholder="Sua senha"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isSignup ? "new-password" : "current-password"}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={passwordLoading || !loginEmail || !password}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    {passwordLoading ? "Processando..." : isSignup ? "Criar conta" : "Entrar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignup((prev) => !prev)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {isSignup ? "Já tenho conta, entrar com senha" : "Criar conta com senha"}
                  </button>
                </form>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded bg-blue-600" aria-hidden />
                  <div>
                    <h2 className="text-lg font-semibold">Acesse com codigo de 6 digitos</h2>
                    <p className="text-sm text-neutral-500">Enviamos um codigo para confirmar sua conta.</p>
                  </div>
                </div>

                <form onSubmit={otpSent ? handleVerifyCode : handleRequestCode} className="space-y-3">
                  <label className="text-sm block">
                    <span className="mb-1 block text-neutral-700">E-mail</span>
                    <input
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600/30"
                      placeholder="seu@email.com"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                    />
                  </label>

                  {otpSent && (
                    <label className="text-sm block">
                      <span className="mb-1 block text-neutral-700">Codigo de 6 digitos</span>
                      <input
                        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none tracking-[0.3em] text-center focus:ring-2 focus:ring-blue-600/30"
                        placeholder="000000"
                        inputMode="numeric"
                        pattern="\\d{6}"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\\D/g, "").slice(0, 6))}
                      />
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={
                      otpSent
                        ? verifyLoading || otpCode.length !== 6 || !loginEmail
                        : otpLoading || !loginEmail
                    }
                    className="inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-white text-sm font-medium transition-colors hover:bg-green-700 disabled:opacity-60"
                  >
                    {otpSent
                      ? verifyLoading
                        ? "Validando..."
                        : "Confirmar código"
                      : otpLoading
                        ? "Enviando..."
                        : "Enviar código"}
                  </button>

                  {otpSent && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                      <span>Codigo enviado. Verifique sua caixa de entrada.</span>
                      <button
                        type="button"
                        onClick={handleRequestCode}
                        disabled={otpLoading || resendCooldown > 0}
                        className="text-blue-600 hover:underline disabled:text-neutral-400"
                      >
                        {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
                      </button>
                    </div>
                  )}
                </form>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded bg-emerald-500" aria-hidden />
                  <div>
                    <h2 className="text-lg font-semibold">Entrar com outra conta</h2>
                    <p className="text-sm text-neutral-500">Conecte com Google ou Facebook.</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => handleOAuth("google")}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Continuar com Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuth("facebook")}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Continuar com Facebook
                  </button>
                </div>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded bg-emerald-500" aria-hidden />
                  <div>
                    <h2 className="text-lg font-semibold">Primeiro acesso?</h2>
                    <p className="text-sm text-neutral-500">Crie sua conta Knexspace One e ative o ecossistema.</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-neutral-600">
                  <p>Configure dominio, convide sua equipe e habilite seus apps.</p>
                  <Link
                    href="/knexit-workspace/acesso/novo"
                    className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 no-underline"
                  >
                    Criar conta agora
                  </Link>
                  <p className="text-xs text-neutral-500">Se ja possui conta, use o codigo de acesso ao lado.</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-neutral-200 bg-neutral-100/60">
        <div className="mx-auto max-w-5xl px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <MascoteSVG />
            <a
              href="/reclame-aqui"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2"
              title='ReclameAQUI é " KNEXIT"'
            >
              <RASeal />
              <span className="text-xs text-neutral-700 leading-tight">
                RA 1000
                <br />
                ReclameAQUI
              </span>
            </a>
          </div>

          <div className="text-center">
            <p className="text-base font-semibold">Segurança</p>
            <div className="mt-2 inline-flex items-center gap-3">
              <ShieldIcon className="h-6 w-6" />
              <div className="text-sm text-neutral-600 inline-flex items-center gap-2">
                <GoogleLock />
                <span>Site Seguro</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-neutral-600 text-center md:text-right">
            <p className="font-medium">Fale conosco:</p>
            <p>WhatsApp</p>
            <p>Seg a sex (exceto feriados) / das 8h às 20h</p>
            <p>Sábado (9h às 13h)</p>
          </div>
        </div>

        <div className="border-t border-neutral-200 bg-neutral-100">
          <div className="mx-auto max-w-5xl px-4 py-3 text-[11px] text-neutral-500">
            KNEXIT © 2025 — Todos os direitos reservados ©
          </div>
        </div>
      </footer>
    </div>
  );
}

function MascoteSVG() {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#76D275" />
      <circle cx="20" cy="15" r="6" fill="white" />
      <rect x="10" y="24" width="20" height="8" rx="4" fill="white" />
    </svg>
  );
}

function RASeal() {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="4" fill="#E8F5E9" stroke="#34A853" />
      <path d="M12 22l5 5 11-11" stroke="#34A853" strokeWidth="3" fill="none" />
    </svg>
  );
}

function ShieldIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden="true" fill="currentColor">
      <path d="M12 2l7 3v6c0 5-3.4 9.3-7 11-3.6-1.7-7-6-7-11V5l7-3z" />
    </svg>
  );
}

function GoogleLock() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="10" width="18" height="10" rx="2" fill="#E8EAED" />
      <path d="M7 10V8a5 5 0 0110 0v2h-2V8a3 3 0 10-6 0v2H7z" fill="#4285F4" />
    </svg>
  );
}
