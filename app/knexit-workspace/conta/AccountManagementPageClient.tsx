"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import type { User } from "@supabase/supabase-js";

const supabase = identitySupabase();

type Profile = {
  name: string;
  email: string;
  initials: string;
  avatarUrl: string;
};

const FALLBACK_PROFILE: Profile = {
  name: "Conta Knex",
  email: "conta@knexspace.com",
  initials: "KX",
  avatarUrl: "",
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();

const getInitials = (name: string, email: string) => {
  const source = name || email || "Knex";
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (source.includes("@")) return source.slice(0, 2).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

const buildProfile = (user: User | null): Profile => {
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
  const avatarUrl = String(metadata.avatar_url || metadata.picture || metadata.avatar || "");
  const resolvedName = name || email || FALLBACK_PROFILE.name;
  const resolvedEmail = email || FALLBACK_PROFILE.email;
  return {
    name: resolvedName,
    email: resolvedEmail,
    initials: getInitials(resolvedName, resolvedEmail),
    avatarUrl,
  };
};

const NAV_ITEMS = [
  {
    label: "Início",
    desc: "Visão geral da conta e atalhos principais",
    color: "bg-blue-100 text-blue-600",
    icon: "home",
  },
  {
    label: "Informações pessoais",
    desc: "Nome, e-mail, telefone e endereço",
    color: "bg-emerald-100 text-emerald-600",
    icon: "user",
  },
  {
    label: "Segurança e login",
    desc: "Ocorrências recentes, gerenciador de senhas e verificação",
    color: "bg-sky-100 text-sky-600",
    icon: "shield",
  },
  {
    label: "Senha Knex",
    desc: "Gerencie sua senha e métodos de acesso",
    color: "bg-indigo-100 text-indigo-600",
    icon: "key",
  },
  {
    label: "Conexões de terceiros",
    desc: "Gerencie conexões da sua conta Knex e outras contas",
    color: "bg-teal-100 text-teal-600",
    icon: "link",
  },
  {
    label: "Dados e privacidade",
    desc: "Histórico, apps e serviços, exclusão de dados",
    color: "bg-violet-100 text-violet-600",
    icon: "lock",
  },
  {
    label: "Pessoas e compartilhamento",
    desc: "Contatos, usuários bloqueados e compartilhamentos",
    color: "bg-rose-100 text-rose-600",
    icon: "users",
  },
  {
    label: "Pagamentos e assinaturas",
    desc: "Compras, assinaturas e formas de pagamento",
    color: "bg-amber-100 text-amber-600",
    icon: "card",
  },
  {
    label: "Armazenamento do Knex One",
    desc: "Uso de armazenamento, upgrade e backups",
    color: "bg-orange-100 text-orange-600",
    icon: "cloud",
  },
];

const QUICK_ACTIONS = ["Minha senha", "Dispositivos", "Gerenciador de senhas", "Minha atividade", "E-mail"];

const Icon = {
  home: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
    </svg>
  ),
  user: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20c1.6-4 13.4-4 16 0" />
    </svg>
  ),
  shield: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" />
    </svg>
  ),
  key: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="8" cy="12" r="3" />
      <path d="M11 12h10v3h-3v3h-3v3" />
    </svg>
  ),
  link: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M10 7h-2a5 5 0 0 0 0 10h2" />
      <path d="M14 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M9 12h6" />
    </svg>
  ),
  lock: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  users: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="8" cy="9" r="3" />
      <circle cx="16.5" cy="10" r="2.5" />
      <path d="M3 20c1.2-3 8.8-3 10 0" />
      <path d="M12 19c.6-2.2 5.4-2.2 6 0" />
    </svg>
  ),
  card: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  cloud: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M7 18a4 4 0 1 1 1-7.9A5 5 0 0 1 18 12a3 3 0 0 1 0 6H7z" />
    </svg>
  ),
  help: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  apps: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="6" cy="6" r="2" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="12" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  search: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  camera: ({ className = "" }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 7h4l2-2h4l2 2h4v12H4z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  ),
};

export default function AccountManagementPageClient() {
  const [profile, setProfile] = useState<Profile>(FALLBACK_PROFILE);
  const [loading, setLoading] = useState(true);
  const [activeQuickAction, setActiveQuickAction] = useState<string>(QUICK_ACTIONS[0]);
  const [activeNavItem, setActiveNavItem] = useState<string>(NAV_ITEMS[0].label);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setProfile(buildProfile(data.user ?? null));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setProfile(buildProfile(session?.user ?? null));
      setLoading(false);
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const handleAvatarSelect = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Escolha uma imagem válida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("A imagem deve ter até 5MB.");
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    setNotice(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      let session = sessionData?.session ?? null;
      if (!session || sessionError) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session) {
          session = refreshed.session;
        }
      } else if (session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 30) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session) {
          session = refreshed.session;
        }
      }
      if (!session) {
        throw new Error("Faça login para atualizar a imagem.");
      }
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/auth/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !payload?.url) {
        throw new Error(payload?.message ?? "Não foi possível atualizar a imagem.");
      }
      const avatarUrl = payload.url;
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", session.user.id);
      setProfile((prev) => ({ ...prev, avatarUrl }));
      setNotice("Imagem atualizada com sucesso.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível atualizar a imagem.";
      setAvatarError(message);
    } finally {
      setAvatarUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#edf3f7] text-slate-700 flex items-center justify-center px-6">
        Carregando...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#edf3f7] text-slate-900 flex flex-col lg:h-[100dvh] lg:overflow-hidden">
      <div className="mx-auto flex w-full max-w-none flex-1 flex-col px-4 pb-4 pt-0 sm:px-6 min-h-0">
        <header className="sticky top-0 z-50 -mx-4 bg-[#edf3f7]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 max-[869px]:py-3">
          <div className="flex w-full flex-wrap items-start justify-between gap-4 max-[869px]:items-center max-[869px]:flex-nowrap max-[869px]:gap-2">
            <div className="text-lg font-semibold text-slate-700 max-[869px]:text-base max-[869px]:shrink-0">
              Conta Knex
            </div>
            <div className="hidden max-[869px]:flex flex-1 min-w-0 px-2">
              <div className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                <Icon.search className="h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  placeholder="Pesquisar na Conta Knex"
                  className="w-full bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="ml-auto flex items-start gap-3">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow"
                aria-label="Ajuda"
              >
                <Icon.help className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow"
                aria-label="Apps"
              >
                <Icon.apps className="h-4 w-4" />
              </button>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 via-emerald-400 to-rose-500 p-[2px]">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
                  {profile.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.name}
                      width={36}
                      height={36}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="text-xs font-semibold text-slate-600">{profile.initials}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />

        <div className="pt-4">
          <div className="lg:hidden">
            <div className="max-[869px]:hidden">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-600 via-emerald-400 to-rose-500 p-[3px]">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xl font-semibold text-slate-700">
                      {profile.avatarUrl ? (
                        <Image
                          src={profile.avatarUrl}
                          alt={profile.name}
                          width={80}
                          height={80}
                          className="h-full w-full rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        profile.initials
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAvatarSelect}
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Atualizar foto"
                  >
                    <Icon.camera className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">{profile.name}</h1>
                  <p className="text-sm text-slate-500">{profile.email}</p>
                </div>
              </div>

              {avatarError ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                  {avatarError}
                </p>
              ) : null}
              {notice ? (
                <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  {notice}
                </p>
              ) : null}

              <div className="mt-6">
                <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-3">
                  <Icon.search className="h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Pesquisar na conta Knex"
                    className="w-full bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {QUICK_ACTIONS.map((action) => {
                    const isActive = activeQuickAction === action;
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => setActiveQuickAction(action)}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                          isActive
                            ? "border-[#2F7E95] bg-[#2F7E95] text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {action}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="hidden max-[869px]:block">
              <div className="relative inline-block">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-600 via-emerald-400 to-rose-500 p-[3px]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-2xl font-semibold text-slate-700">
                    {profile.avatarUrl ? (
                      <Image
                        src={profile.avatarUrl}
                        alt={profile.name}
                        width={96}
                        height={96}
                        className="h-full w-full rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      profile.initials
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAvatarSelect}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Atualizar foto"
                >
                  <Icon.camera className="h-4 w-4 text-slate-500" />
                </button>
              </div>
              <div className="mt-2">
                <h1 className="text-lg font-semibold text-slate-900">{profile.name}</h1>
                <p className="text-sm text-slate-500">{profile.email}</p>
              </div>
            </div>

            <div className="mt-6 space-y-4 max-[869px]:hidden">
              {NAV_ITEMS.map((item) => {
                const ItemIcon = (Icon as Record<string, ({ className }: { className?: string }) => JSX.Element>)[
                  item.icon
                ];
                const isActive = activeNavItem === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveNavItem(item.label)}
                    className={`flex w-full items-start gap-4 rounded-3xl border px-4 py-4 text-left shadow-sm transition ${
                      isActive
                        ? "border-[#2F7E95] bg-[#e6f6f9]"
                        : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                      <ItemIcon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{item.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 hidden space-y-4 max-[869px]:block">
              {NAV_ITEMS.filter((item) => item.label !== "In\u00edcio").map((item) => {
                const ItemIcon = (Icon as Record<string, ({ className }: { className?: string }) => JSX.Element>)[
                  item.icon
                ];
                const isActive = activeNavItem === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveNavItem(item.label)}
                    className={`flex w-full items-start gap-4 rounded-3xl border px-4 py-4 text-left shadow-sm transition ${
                      isActive
                        ? "border-[#2F7E95] bg-[#e6f6f9]"
                        : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                      <ItemIcon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{item.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 hidden flex-col gap-5 lg:flex lg:flex-row">
            <aside className="w-full lg:max-w-[280px]">
              <nav className="flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:gap-4 lg:overflow-visible">
                {NAV_ITEMS.map((item) => {
                  const ItemIcon = (Icon as Record<string, ({ className }: { className?: string }) => JSX.Element>)[
                    item.icon
                  ];
                  const isActive = activeNavItem === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveNavItem(item.label)}
                    className={`flex min-w-[200px] items-center gap-3 rounded-full border px-4 py-2.5 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow lg:min-w-0 ${
                      isActive
                        ? "border-[#2F7E95] bg-[#e6f6f9] text-[#1f5e72]"
                        : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${item.color}`}
                    >
                      <ItemIcon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="flex-1">
              <div className="rounded-3xl bg-white p-4 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.6)]">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-600 via-emerald-400 to-rose-500 p-[3px]">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-2xl font-semibold text-slate-700">
                        {profile.avatarUrl ? (
                          <Image
                            src={profile.avatarUrl}
                            alt={profile.name}
                            width={96}
                            height={96}
                            className="h-full w-full rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          profile.initials
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAvatarSelect}
                      disabled={avatarUploading}
                      className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Atualizar foto"
                    >
                      <Icon.camera className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                  <h1 className="mt-4 text-2xl font-semibold text-slate-900">{profile.name}</h1>
                  <p className="mt-1 text-sm text-slate-500">{profile.email}</p>
                </div>

                {avatarError ? (
                  <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                    {avatarError}
                  </p>
                ) : null}
                {notice ? (
                  <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                    {notice}
                  </p>
                ) : null}

                <div className="mt-5 flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                  <Icon.search className="h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Pesquisar na conta Knex"
                    className="w-full bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>

                <div className="mt-3 flex flex-wrap justify-center gap-2.5">
                  {QUICK_ACTIONS.map((action) => {
                    const isActive = activeQuickAction === action;
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => setActiveQuickAction(action)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                          isActive
                            ? "border-[#2F7E95] bg-[#2F7E95] text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {action}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 text-left text-xs text-slate-500">
                  Só você pode ver suas configurações. Você pode revisar permissões, segurança e integrações
                  diretamente aqui.
                </div>
              </div>
            </section>
          </div>
        </div>

        <footer className="mt-auto flex flex-wrap items-center justify-center gap-4 pt-4 text-xs text-slate-500">
          <span>Privacidade</span>
          <span className="h-1 w-1 rounded-full bg-slate-400" />
          <span>Termos</span>
          <span className="h-1 w-1 rounded-full bg-slate-400" />
          <span>Ajuda</span>
        </footer>
      </div>
    </main>
  );
}
