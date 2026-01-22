"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_PRODUCT_SLUG, getProduct, ProductEntry, ProductSlug } from "@/lib/products";

type LoginPageClientProps = {
  productSlug?: ProductSlug | null;
  initialFrom?: string | null;
  initialProduct?: string | null;
  initialRedirect?: string | null;
};

const DEFAULT_PRODUCT = getProduct(DEFAULT_PRODUCT_SLUG)!;
const ALLOWED_EMAILS = new Set(["fmedeiros58@gmail.com"]);

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
}: LoginPageClientProps) {
  const router = useRouter();
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const allowedDomain = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || "";

  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  const isAllowedEmail = useCallback((email?: string | null) => {
    if (!email) return false;
    const lowered = email.toLowerCase();
    if (ALLOWED_EMAILS.has(lowered)) return true;
    if (allowedDomain) return lowered.includes(allowedDomain);
    return true;
  }, [allowedDomain]);

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

  const loginReturnUrl = useMemo(() => {
    const base =
      appBaseUrl || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");
    try {
      const url = new URL(base);
      url.pathname = "/login";
      if (targetRedirect) url.searchParams.set("from", targetRedirect);
      if (activeProductSlug) url.searchParams.set("product", activeProductSlug);
      return url.toString();
    } catch {
      return `${base}/login`;
    }
  }, [targetRedirect, activeProductSlug, appBaseUrl]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && typeof window !== "undefined") {
        const email = session?.user?.email ?? null;
        if (email && !isAllowedEmail(email)) {
          setErr("Apenas e-mails do domínio Knexit são permitidos.");
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
          setErr("Apenas e-mails do domínio Knexit são permitidos.");
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

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoadingLogin(true);
    if (!isAllowedEmail(loginEmail)) {
      setLoadingLogin(false);
      setErr("Apenas e-mails do domínio Knexit são permitidos.");
      return;
    }
    if (typeof window !== "undefined" && postAuthRedirect) {
      localStorage.setItem("postAuthRedirect", postAuthRedirect);
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoadingLogin(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data?.session) {
      const to = localStorage.getItem("postAuthRedirect") || postAuthRedirect || targetRedirect;
      localStorage.removeItem("postAuthRedirect");
      if (to) router.replace(to);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSignupLoading(true);
    if (!isAllowedEmail(signupEmail)) {
      setSignupLoading(false);
      setErr("Apenas e-mails do domínio Knexit são permitidos.");
      return;
    }
    if (typeof window !== "undefined" && postAuthRedirect) {
      localStorage.setItem("postAuthRedirect", postAuthRedirect);
    }
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password,
      options: {
        data: { name, phone },
        emailRedirectTo: loginReturnUrl,
      },
    });
    setSignupLoading(false);
    if (error) setErr(error.message);
    else {
      alert("Cadastro iniciado! Verifique seu e-mail para confirmar a conta.");
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-9 w-9 rounded bg-neutral-900" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold">Cadastre-se para criar sua conta</h2>
                <p className="text-sm text-neutral-500">Fluxo em duas etapas: cadastro e login com senha.</p>
              </div>
            </div>
            <form onSubmit={handleSignup} className="grid grid-cols-1 gap-3">
              <Labeled label="Nome" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
              <Labeled
                type="email"
                label="E-mail"
                placeholder="seu@email.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
              />
              <Labeled label="Celular" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <label className="text-sm">
                <span className="mb-1 block text-neutral-700">Senha cadastro</span>
                <div className="flex">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full rounded-l-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="rounded-r-lg border border-l-0 border-neutral-300 bg-neutral-100 px-3 text-xs"
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    title={showPass ? "Ocultar" : "Mostrar"}
                  >
                    <EyeIcon open={showPass} />
                    <span className="ml-1">{showPass ? "Ocultar" : "Mostrar"}</span>
                  </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">Mínimo de 6 caracteres, incluindo 1 letra e 1 número</p>
              </label>

              <div className="flex items-start gap-2 text-xs text-neutral-500">
                <input type="checkbox" required className="mt-0.5" />
                <span>
                  Ao cadastrar-se, você concorda com a nossa{" "}
                  <a className="underline underline-offset-2" href="#" onClick={(e) => e.preventDefault()}>
                    Política de Privacidade
                  </a>
                  .
                </span>
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
              >
                {signupLoading ? "Cadastrando..." : "Cadastrar"}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-9 w-9 rounded bg-orange-500" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold">Entre na sua conta para continuar</h2>
                <p className="text-sm text-neutral-500">Use e-mail e senha cadastrados.</p>
              </div>
            </div>
            <form onSubmit={handlePasswordLogin} className="space-y-3">
              <label className="text-sm block">
                <span className="mb-1 block text-neutral-700">E-mail</span>
                <input
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600/30"
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
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600/30"
                  placeholder="********"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>

              <button
                type="submit"
                disabled={loadingLogin || !loginEmail || !loginPassword}
                className="inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-white text-sm font-medium transition-colors hover:bg-green-700 disabled:opacity-60"
              >
                {loadingLogin ? "Entrando..." : "Entrar"}
              </button>

            </form>
            </section>
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

function Labeled(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="text-sm">
      <span className="mb-1 block text-neutral-700">{label}</span>
      <input
        {...rest}
        className={`w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm ${className ?? ""}`}
      />
    </label>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z" />
    </svg>
  ) : (
    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 12s3-7 10-7c2.1 0 3.9.6 5.5 1.5l1.6-1.6 1.4 1.4-18 18-1.4-1.4 3-3C2.8 17 2 12 2 12zm10 5c-1.1 0-2.1-.3-2.9-.8l1.5-1.5c.4.2.9.3 1.4.3a4 4 0 004-4c0-.5-.1-1-.3-1.4l1.5-1.5c.5.8.8 1.8.8 2.9a6 6 0 01-6 6z" />
    </svg>
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
