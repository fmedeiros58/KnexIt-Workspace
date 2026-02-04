"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const theme = {
  "--kx-bg": "#E6F2F4",
  "--kx-ink": "#0b1220",
  "--kx-muted": "#51616E",
  "--kx-card": "#ffffff",
  "--kx-border": "#D5E6EA",
  "--kx-primary": "#3E8FA3",
  "--kx-secondary": "#2F7E95",
  "--kx-accent": "#f59e0b",
} as CSSProperties;

const PRODUCTS = [
  { name: "KnexDrive", color: "bg-blue-50 text-blue-700" },
  { name: "VioClass", color: "bg-indigo-50 text-indigo-700" },
  { name: "VioLive", color: "bg-rose-50 text-rose-700" },
  { name: "VioRead", color: "bg-sky-50 text-sky-700" },
  { name: "KnexAI", color: "bg-emerald-50 text-emerald-700" },
  { name: "KnexMail", color: "bg-amber-50 text-amber-700" },
];

type UserProfile = {
  name: string;
  email: string;
  initials: string;
  imageUrl: string;
};

const FALLBACK_PROFILE: UserProfile = {
  name: "Conta KnexIT",
  email: "Conecte sua conta",
  initials: "KX",
  imageUrl: "",
};

function toTitleCase(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();
}

function getInitials(name: string, email: string) {
  const source = name || email || "KnexIT";
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (source.includes("@")) {
    return source.slice(0, 2).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function buildProfile(user: User | null): UserProfile {
  if (!user) return FALLBACK_PROFILE;
  const email = user.email ?? "";
  const metadata = user.user_metadata ?? {};
  const rawName =
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    metadata.preferred_username ||
    (email ? email.split("@")[0] : "");
  const name = toTitleCase(String(rawName || "").replace(/[._-]/g, " "));
  const imageUrl = String(metadata.avatar_url || metadata.picture || metadata.avatar || "");
  const resolvedName = name || email || FALLBACK_PROFILE.name;
  const resolvedEmail = email || FALLBACK_PROFILE.email;
  return {
    name: resolvedName,
    email: resolvedEmail,
    initials: getInitials(resolvedName, resolvedEmail),
    imageUrl,
  };
}

export default function KnexitWorkspaceAccessPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<UserProfile>(FALLBACK_PROFILE);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuOpen) return;
      const target = event.target as Node | null;
      if (target && menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setProfile(buildProfile(data.user ?? null));
    };

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setProfile(buildProfile(session?.user ?? null));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  function handleAddAccount() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("loginEmailHint");
    }
    router.push("/login");
  }

  function handleUseAccount() {
    if (typeof window !== "undefined") {
      if (profile.email.includes("@")) {
        localStorage.setItem("loginEmailHint", profile.email);
      }
    }
    router.push("/login");
  }

  async function handleSignOut() {
    setMenuOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("loginEmailHint");
    }
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main
      className="min-h-[100dvh] bg-[var(--kx-bg)] text-[var(--kx-ink)] font-[family:Arial,Helvetica,sans-serif]"
      style={theme}
    >
      <style>{`
        .fade-up {
          animation: fadeUp 0.7s ease-out both;
        }
        .fade-up.delay-1 {
          animation-delay: 0.08s;
        }
        .fade-up.delay-2 {
          animation-delay: 0.16s;
        }
        .floaty {
          animation: floaty 5s ease-in-out infinite;
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes floaty {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>

      <div className="relative min-h-[100dvh] overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-8 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute right-[-120px] top-24 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-80px] left-1/3 h-56 w-56 rounded-full bg-amber-200/50 blur-3xl" />

        <header className="relative z-10 border-b border-slate-200/80 bg-white/70 backdrop-blur">
          <div className="mx-auto grid w-full grid-cols-[1fr,auto,1fr] items-center px-4 py-4 sm:px-6 lg:px-8">
            <div />
            <Link
              href="/knexit-workspace"
              className="text-[clamp(1.4rem,2.6vw,1.85rem)] font-semibold tracking-tight no-underline hover:no-underline"
            >
              <span className="text-blue-700">Knexspace</span>
              <span className="text-slate-900"> One</span>
            </Link>
            <div className="flex justify-end">
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-emerald-400 to-rose-500 p-[2px] shadow-sm"
                >
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-700">
                    {profile.imageUrl ? (
                      <img src={profile.imageUrl} alt={profile.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      profile.initials
                    )}
                  </span>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
                    <CameraIcon />
                  </span>
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-[min(92vw,320px)] rounded-3xl border border-slate-200 bg-[#eef3f8] p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.6)]"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-semibold text-slate-600">{profile.email}</p>
                      <button
                        type="button"
                        onClick={() => setMenuOpen(false)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-white"
                        aria-label="Fechar menu"
                      >
                        <CloseIcon />
                      </button>
                    </div>

                    <div className="mt-4 flex flex-col items-center text-center">
                      <div className="relative">
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-600 via-emerald-400 to-rose-500 p-[2px]">
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-2xl font-semibold text-slate-700">
                            {profile.imageUrl ? (
                              <img src={profile.imageUrl} alt={profile.name} className="h-full w-full rounded-full object-cover" />
                            ) : (
                              profile.initials
                            )}
                          </div>
                        </div>
                        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow">
                          <CameraIcon />
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-900">Olá, {profile.name}!</p>
                      <button
                        type="button"
                        className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Gerenciar sua conta KnexIT
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={handleAddAccount}
                        className="flex min-h-[44px] items-center justify-center gap-2 px-3 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <PlusIcon />
                        Adicionar conta
                      </button>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex min-h-[44px] items-center justify-center gap-2 border-l border-slate-200 px-3 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <ExitIcon />
                        Sair
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-slate-500">
                      <span>Política de Privacidade</span>
                      <span className="h-1 w-1 rounded-full bg-slate-400" />
                      <span>Termos de Serviço</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 md:py-12 lg:grid-cols-[minmax(0,1.05fr),minmax(0,0.95fr)] lg:items-center lg:px-8 lg:py-14">
          <section className="space-y-6 fade-up">
            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {PRODUCTS.map((product) => (
                <span
                  key={product.name}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold sm:text-xs ${product.color}`}
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-60" />
                  {product.name}
                </span>
              ))}
            </div>

            <div className="text-center md:text-left">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Acesso Knexspace One</p>
              <h1 className="mt-3 text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-tight">
                Vamos começar
              </h1>
              <p className="mt-3 max-w-[60ch] text-[clamp(1rem,1.2vw,1.1rem)] text-[var(--kx-muted)] mx-auto md:mx-0">
                Centralize seus produtos, permissões e equipes em uma única conta. Escolha como você quer entrar no
                KnexIT Workspace.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--kx-border)] bg-[var(--kx-card)] p-5 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.4)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Criar nova conta Workspace</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Comece do zero com um e-mail profissional para sua equipe, cursos ou comunidade.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Recomendado
                </span>
              </div>
              <Link
                href="/knexit-workspace/acesso/novo"
                className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[var(--kx-primary)] px-4 py-3 text-center text-sm font-semibold leading-snug text-white shadow-lg shadow-blue-500/20 hover:brightness-110 no-underline hover:no-underline sm:px-5"
              >
                Criar uma nova conta
              </Link>
            </div>

            <div className="rounded-3xl border border-[var(--kx-border)] bg-white/80 p-5 backdrop-blur">
              <p className="text-sm font-semibold text-slate-900">Usar conta existente</p>
              <p className="mt-1 text-sm text-slate-600">
                Se você já tem um e-mail no KnexIT Workspace, continue e sincronize os produtos atuais.
              </p>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {profile.imageUrl ? (
                      <img src={profile.imageUrl} alt={profile.name} className="h-full w-full object-cover" />
                    ) : (
                      profile.initials
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{profile.name}</p>
                    <p className="text-xs text-slate-500">{profile.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUseAccount}
                  className="min-h-[44px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-center text-xs font-semibold leading-snug text-slate-700 hover:bg-slate-50 no-underline hover:no-underline sm:w-auto sm:px-4"
                >
                  Entrar com esta conta
                </button>
              </div>
            </div>
          </section>

          <section className="fade-up delay-1 flex flex-col items-center justify-center text-center">
            <div className="max-w-md space-y-3 text-center">
              <h2 className="text-[clamp(1.6rem,2.6vw,2.2rem)] font-semibold">
                Produtividade, conteúdo e comunicação em um único fluxo
              </h2>
              <p className="text-[clamp(0.95rem,1.1vw,1rem)] text-[var(--kx-muted)]">
                O KnexIT Workspace conecta KnexDrive, VioClass e KnexAI para que seus times planejem, entreguem e
                acompanhem resultados em tempo real.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/knexit-workspace#produtos"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline hover:no-underline"
                >
                  Ver produtos
                </Link>
                <Link
                  href="/knexit-workspace#contato"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--kx-secondary)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 no-underline hover:no-underline"
                >
                  Falar com a equipe
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-700" aria-hidden="true">
      <path
        d="M8.5 5.5h7l1.2 2H19a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2h2.3l1.2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M15 7h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10 17l5-5-5-5M15 12H5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
