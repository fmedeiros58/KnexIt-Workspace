"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import { getCurrentUser } from "../../../../lib/auth";

type Provider = "google" | "facebook";
// Redirecionamento padrão para o produto SupaDrive
const DEFAULT_PRODUCT = "supadrive";
const PRODUCT_MAP: Record<
  string,
  {
    label: string;
    target: string;
  }
> = {
  supadrive: { label: "SupaDrive", target: "/supadrive" },
  vioclass: { label: "VioClass", target: "/vioclass" },
  violive: { label: "VioLive", target: "/violive" },
  vioread: { label: "VioRead", target: "/vioread" },
  vioanalytics: { label: "VioAnalytics", target: "/vioanalytics" },
  viorecord: { label: "VioRecord", target: "/viorecord" },
  viostudio: { label: "VioStudio", target: "/viostudio" },
  knexai: { label: "KnexAI", target: "/knexai" },
  knexchat: { label: "KnexChat", target: "/knexchat" },
  knexdocs: { label: "KnexDocs", target: "/knexdocs" },
  knexflow: { label: "KnexFlow", target: "/knexflow" },
  knexmail: { label: "KnexMail", target: "/knexmail" },
  knexpay: { label: "KnexPay", target: "/knexpay" },
  knexreview: { label: "KnexReview", target: "/knexreview" },
  knexsearch: { label: "KnexSearch", target: "/knexsearch" },
  "knexit-workspace": { label: "KnexIT Workspace", target: "/knexit-workspace" },
};

export default function PortalLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginSent, setLoginSent] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);

  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  const { targetRedirect, productLabel } = useMemo(() => {
    if (typeof window === "undefined") {
      const defaultProduct = PRODUCT_MAP[DEFAULT_PRODUCT];
      return {
        targetRedirect: defaultProduct.target,
        productLabel: defaultProduct.label,
      };
    }
    const origin = window.location.origin;
    const from = searchParams?.get("from");
    const productParam = searchParams?.get("product");
    const url = new URL(window.location.href);
    const redirect = url.searchParams.get("redirect");
    const actionUrl = url.searchParams.get("action-url-retorno");

    const slugFromFrom = (() => {
      if (!from) return null;
      const parts = from.split("/").filter(Boolean);
      if (parts[0] === "lobby" && parts[1]) return parts[1];
      return parts[0] ?? null;
    })();

    const inferredSlug = (productParam || slugFromFrom || DEFAULT_PRODUCT).toLowerCase();
    const productConfig = PRODUCT_MAP[inferredSlug] ?? { label: inferredSlug.toUpperCase(), target: `/${inferredSlug}` };

    const target =
      from ||
      (redirect ? new URL(redirect, origin).toString() : null) ||
      (actionUrl ? new URL(actionUrl, origin).toString() : null) ||
      productConfig.target;

    return {
      targetRedirect: target,
      productLabel: productConfig.label,
    };
  }, [searchParams]);

  const postAuthRedirect = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    try {
      return new URL(targetRedirect, window.location.origin).toString();
    } catch {
      return targetRedirect;
    }
  }, [targetRedirect]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && typeof window !== "undefined") {
        const to = localStorage.getItem("postAuthRedirect") || postAuthRedirect || targetRedirect;
        localStorage.removeItem("postAuthRedirect");
        router.push(to);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [postAuthRedirect, targetRedirect, router]);

  // Se já houver usuário autenticado, respeita o redirect "from" imediatamente.
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user && typeof window !== "undefined") {
        const to = localStorage.getItem("postAuthRedirect") || postAuthRedirect || targetRedirect;
        localStorage.removeItem("postAuthRedirect");
        router.replace(to);
      }
    })();
  }, [postAuthRedirect, targetRedirect, router]);

  useEffect(() => {
    if (typeof document !== "undefined") document.title = "KNEXIT | Identificação";
  }, []);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoadingMagic(true);
    if (typeof window !== "undefined" && postAuthRedirect) {
      localStorage.setItem("postAuthRedirect", postAuthRedirect);
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    setLoadingMagic(false);
    if (error) setErr(error.message);
    else setLoginSent(true);
  }

  async function handleOAuth(provider: Provider) {
    setErr(null);
    if (typeof window !== "undefined" && postAuthRedirect) {
      localStorage.setItem("postAuthRedirect", postAuthRedirect);
    }
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          scopes: provider === "google" ? "openid email profile" : "public_profile,email",
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        setErr(`OAuth ${provider}: ${error.message}`);
        return;
      }
      if (!data?.url) {
        setErr(
          `OAuth ${provider}: URL de redirecionamento ausente. Verifique se o provedor está habilitado no Supabase e se o Redirect URI é https://SEU-PROJETO.supabase.co/auth/v1/callback.`
        );
        return;
      }
      window.location.href = data.url;
    } catch (e: any) {
      setErr(`Falha ao iniciar OAuth ${provider}: ${e?.message ?? "erro desconhecido"}`);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSignupLoading(true);
    if (typeof window !== "undefined" && postAuthRedirect) {
      localStorage.setItem("postAuthRedirect", postAuthRedirect);
    }
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password,
      options: {
        data: { name, phone },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    setSignupLoading(false);
    if (error) setErr(error.message);
    else {
      alert("Cadastro iniciado! Verifique seu e-mail para confirmar a conta.");
    }
  }

  return (
    <div className="min-h-[100svh] bg-neutral-50 text-neutral-900">
      <header className="w-full border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-red-600" aria-hidden />
            <span className="text-lg font-semibold tracking-tight">
              <span className="text-red-600">UP</span>GRADE
            </span>
          </div>
          <div className="text-xs md:text-sm text-neutral-600">
            Você será direcionado para <strong>{productLabel}</strong> após entrar.
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-9 w-9 rounded bg-neutral-900" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold">Cadastre-se para criar sua conta</h2>
                <p className="text-sm text-neutral-500">e iniciar seus estudos!</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleOAuth("facebook")}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white"
              >
                <FacebookIcon />
                Cadastrar com Facebook
              </button>
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800"
              >
                <GoogleG />
                Cadastrar com Google
              </button>
            </div>

            <div className="my-5 h-px w-full bg-neutral-200" />

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
                    placeholder="••••••"
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
                <p className="mt-1 text-xs text-neutral-500">Mínimo de 6 caracteres · 1 letra · 1 número</p>
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
                className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
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
                <p className="text-sm text-neutral-500">seus estudos!</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-3">
              <button
                type="button"
                onClick={() => handleOAuth("facebook")}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white"
              >
                <FacebookIcon />
                Entrar com Facebook
              </button>
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800"
              >
                <GoogleG />
                Entrar com Google
              </button>
            </div>

            <div className="my-5 h-px w-full bg-neutral-200" />

            <form onSubmit={handleMagicLink} className="space-y-3">
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

              <button
                type="submit"
                disabled={loadingMagic || !loginEmail}
                className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-white text-sm font-medium transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {loadingMagic ? "Enviando..." : "Enviar link mágico"}
              </button>

              <div className="flex items-center justify-center text-xs">
                <a href="#" onClick={(e) => e.preventDefault()} className="text-neutral-600 underline underline-offset-2">
                  Esqueceu a senha?
                </a>
              </div>
            </form>

            {loginSent && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 border border-emerald-200">
                Enviamos um link de acesso para o seu e-mail. Abra pelo mesmo dispositivo para entrar.
              </p>
            )}
            {err && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">
                {err}
              </p>
            )}
          </section>
        </div>
      </main>

      <section className="mt-6 border-t border-neutral-200 bg-neutral-100/60">
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
            <p>📞 WhatsApp</p>
            <p>Seg a sex (exceto feriados) / das 8h às 20h</p>
            <p>Sábado (9h às 13h)</p>
          </div>
        </div>

        <div className="border-t border-neutral-200 bg-neutral-100">
          <div className="mx-auto max-w-5xl px-4 py-3 text-[11px] text-neutral-500">
            KNEXIT © 2025 — Todos os direitos reservados —
          </div>
        </div>
      </section>
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

function FacebookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-white">
      <path d="M22 12.06C22 6.49 17.52 2 11.94 2 6.37 2 1.88 6.49 1.88 12.06c0 4.99 3.65 9.14 8.43 10v-7.07H7.9v-2.93h2.41V9.69c0-2.38 1.42-3.7 3.6-3.7 1.04 0 2.13.19 2.13.19v2.34h-1.2c-1.18 0-1.55.73-1.55 1.48v1.78h2.64l-.42 2.93h-2.22V22c4.78-.86 8.43-5.01 8.43-9.94Z" />
    </svg>
  );
}

function GoogleG() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4818h4.84c-.2082 1.125-.8414 2.0773-1.7905 2.7164v2.2582h2.8977c1.6964-1.5637 2.6928-3.8646 2.6928-6.6155z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.466-0.806 5.954-2.1791l-2.8977-2.2582c-.8059.54-1.8377.8591-3.0563.8591-2.3518 0-4.3446-1.5864-5.0563-3.7182H.9636v2.3373C2.4446 15.9828 5.4818 18 9 18z" fill="#34A853" />
      <path d="M3.9437 10.7036c-.18-.54-.2837-1.1164-.2837-1.7036s.1036-1.1636.2837-1.7036V4.959H.9636C.3491 6.1777 0 7.5577 0 9c0 1.4423.3491 2.8223.9636 4.041l2.98-2.3374z" fill="#FBBC05" />
      <path d="M9 3.5455c1.3205 0 2.5105.4545 3.4459 1.3455l2.5841-2.5841C13.4591.86 11.43 0 9 0 5.4818 0 2.4446 2.0173.9636 4.959l2.98 2.3373C4.6555 5.1318 6.6482 3.5455 9 3.5455z" fill="#EA4335" />
    </svg>
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
