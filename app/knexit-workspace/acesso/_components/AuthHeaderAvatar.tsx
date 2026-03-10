"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import type { Session, User } from "@supabase/supabase-js";
import { getAppBaseUrl, resolvePostLoginTarget, resolveReturnTo } from "../_lib/authFlow";
import { writeKnexchatProfileSeed } from "@/lib/knexchat/profileSeed";
import SettingsFloatingModal, { type SettingsSectionKey } from "./SettingsFloatingModal";

const supabase = identitySupabase();

type AvatarState = {
  url: string;
  initials: string;
  name?: string;
  email?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECENT_ACCOUNTS_KEY = "knex_recent_accounts";
const ACCOUNT_SESSIONS_KEY = "knex_account_sessions";
const SWITCH_SESSION_TIMEOUT_MS = 1800;

const getInitials = (name: string, email: string) => {
  const source = name || email || "Knex";
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (source.includes("@")) return source.slice(0, 2).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();

type StoredAccount = {
  email: string;
  name?: string;
  avatarUrl?: string;
  lastUsed?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number | null;
};

type SessionResult = {
  data: { session: Session | null };
  error: Error | null;
};

const setSessionWithTimeout = async (accessToken: string, refreshToken: string): Promise<SessionResult> => {
  let timer: number | null = null;
  const timeoutResult = new Promise<SessionResult>((resolve) => {
    timer = window.setTimeout(() => {
      resolve({ data: { session: null }, error: new Error("session_timeout") });
    }, SWITCH_SESSION_TIMEOUT_MS);
  });
  const setSessionResult = supabase.auth
    .setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    .then((result) => ({ data: result.data, error: result.error as Error | null }))
    .catch((error) => ({ data: { session: null }, error: error instanceof Error ? error : new Error("session_failed") }));

  try {
    return await Promise.race([setSessionResult, timeoutResult]);
  } finally {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  }
};

const readRecentAccounts = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => EMAIL_REGEX.test(value));
  } catch {
    return [];
  }
};

const readStoredAccounts = (): Record<string, StoredAccount> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ACCOUNT_SESSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredAccount>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const resolveStoredAccount = (): StoredAccount | null => {
  const recent = readRecentAccounts();
  const stored = readStoredAccounts();
  if (recent.length > 0) {
    const candidate = stored[recent[0]] ?? { email: recent[0] };
    return candidate;
  }
  const storedList = Object.values(stored);
  if (!storedList.length) return null;
  storedList.sort((a, b) => {
    const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
    const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
    return bTime - aTime;
  });
  return storedList[0] ?? null;
};

const resolveAvatarState = (user: User | null): AvatarState | null => {
  if (!user) return null;
  const email = user.email ?? "";
  const metadata = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const name =
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    metadata.preferred_username ||
    (email ? email.split("@")[0] : "");
  const url = String(metadata.avatar_url || metadata.picture || metadata.avatar || "");
  const initials = getInitials(String(name || ""), email);
  return { url, initials, name: String(name || ""), email };
};

export default function AuthHeaderAvatar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appBaseUrl = useMemo(() => getAppBaseUrl(), []);
  const returnTo = useMemo(() => resolveReturnTo(searchParams, appBaseUrl), [appBaseUrl, searchParams]);
  const [avatar, setAvatar] = useState<AvatarState | null>(null);
  const [fallbackAvatar, setFallbackAvatar] = useState<AvatarState | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [storedAccounts, setStoredAccounts] = useState<Record<string, StoredAccount>>({});
  const [recentAccounts, setRecentAccounts] = useState<string[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [switchingAccountEmail, setSwitchingAccountEmail] = useState<string | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSectionKey>("geral");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const buildAccessEmailHref = (email?: string) => {
    const params = new URLSearchParams();
    (["returnTo", "redirect", "from", "stay"] as const).forEach((key) => {
      const value = searchParams?.get(key);
      if (value) params.set(key, value);
    });
    if (email) {
      params.set("email", email);
    } else {
      params.delete("email");
    }
    const query = params.toString();
    return `/knexit-workspace/acesso/email${query ? `?${query}` : ""}`;
  };

  const saveRecentAccount = (email: string) => {
    if (typeof window === "undefined") return;
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) return;
    const existing = readRecentAccounts();
    const next = [normalized, ...existing.filter((item) => item !== normalized)].slice(0, 6);
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(next));
    setRecentAccounts(next);
  };

  const saveAccountSession = (session: Session) => {
    if (typeof window === "undefined") return;
    const email = session.user?.email?.trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) return;
    const metadata = session.user?.user_metadata as {
      full_name?: string;
      name?: string;
      avatar_url?: string;
      picture?: string;
      avatar?: string;
    } | null;
    const name = toTitleCase(
      String(metadata?.full_name ?? metadata?.name ?? email.split("@")[0] ?? "").replace(/[._-]/g, " "),
    );
    const avatarUrl = String(metadata?.avatar_url ?? metadata?.picture ?? metadata?.avatar ?? "");
    const current = readStoredAccounts();
    const next: Record<string, StoredAccount> = {
      ...current,
      [email]: {
        email,
        name,
        avatarUrl,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at ?? null,
        lastUsed: new Date().toISOString(),
      },
    };
    localStorage.setItem(ACCOUNT_SESSIONS_KEY, JSON.stringify(next));
    setStoredAccounts(next);
    saveRecentAccount(email);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAvatar(resolveAvatarState(data.user ?? null));
      setIsLoggedIn(Boolean(sessionData.session?.user));
      if (sessionData.session) {
        saveAccountSession(sessionData.session);
      }
    };
    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAvatar(resolveAvatarState(session?.user ?? null));
      setIsLoggedIn(Boolean(session?.user));
      if (session) {
        saveAccountSession(session);
      }
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = resolveStoredAccount();
    if (!stored) {
      setFallbackAvatar({ url: "", initials: "KX", name: "Knexspace", email: "" });
      return;
    }
    const initials = getInitials(stored.name || "", stored.email);
    setFallbackAvatar({
      url: stored.avatarUrl || "",
      initials,
      name: stored.name,
      email: stored.email,
    });
  }, []);

  useEffect(() => {
    setRecentAccounts(readRecentAccounts());
    setStoredAccounts(readStoredAccounts());
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setAccountSwitcherOpen(false);
    }
  }, [menuOpen]);

  const activeAvatar = useMemo(() => avatar ?? fallbackAvatar, [avatar, fallbackAvatar]);
  const currentEmail = (avatar?.email ?? fallbackAvatar?.email ?? "").trim().toLowerCase();
  const currentDomain = currentEmail.includes("@") ? currentEmail.split("@")[1] : "";
  const formatAccountName = (email: string) => {
    const localPart = email.split("@")[0] ?? "";
    const cleaned = localPart.replace(/[._-]+/g, " ").trim();
    return toTitleCase(cleaned) || email;
  };
  const accountCandidates = useMemo<StoredAccount[]>(() => {
    const storedList = Object.values(storedAccounts);
    if (!storedList.length) {
      return recentAccounts.map((email) => ({ email }));
    }
    const ordered: StoredAccount[] = [];
    recentAccounts.forEach((email) => {
      const storedAccount = storedAccounts[email.toLowerCase()];
      if (storedAccount) {
        ordered.push(storedAccount);
      } else {
        ordered.push({ email });
      }
    });
    storedList.forEach((account) => {
      if (!ordered.some((entry) => entry.email === account.email)) {
        ordered.push(account);
      }
    });
    return ordered;
  }, [recentAccounts, storedAccounts]);
  const switcherAccounts = useMemo(
    () =>
      accountCandidates
        .filter((account) => account.email && account.email.toLowerCase() !== currentEmail)
        .slice(0, 6),
    [accountCandidates, currentEmail],
  );
  const loggedOutPrimaryAccounts = useMemo(
    () => accountCandidates.filter((account) => account.email).slice(0, 2),
    [accountCandidates],
  );
  const loggedOutExtraAccounts = useMemo(
    () => accountCandidates.filter((account) => account.email).slice(2),
    [accountCandidates],
  );

  useEffect(() => {
    if (!isLoggedIn && loggedOutExtraAccounts.length > 0) {
      setAccountSwitcherOpen(true);
    }
  }, [isLoggedIn, loggedOutExtraAccounts.length]);

  const handleAvatarSelect = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Escolha uma imagem valida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("A imagem deve ter ate 5MB.");
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;
      if (!session) {
        throw new Error("Faça login para atualizar a imagem.");
      }
      const token = session.access_token;
      const userId = session.user.id;
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/auth/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !payload?.url) {
        throw new Error(payload?.message ?? "Nao foi possivel atualizar a imagem.");
      }
      const avatarUrl = payload.url;
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl, picture: avatarUrl, avatar: avatarUrl } });
      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
      setAvatar((prev) => (prev ? { ...prev, url: avatarUrl } : prev));
      setFallbackAvatar((prev) => (prev ? { ...prev, url: avatarUrl } : prev));
      const metadata = (session.user.user_metadata as { full_name?: string; name?: string } | null) ?? null;
      const displayName = String(metadata?.full_name ?? metadata?.name ?? avatar?.name ?? fallbackAvatar?.name ?? "").trim();
      writeKnexchatProfileSeed(session.user.id, {
        avatarUrl,
        ...(displayName ? { displayName } : {}),
        source: "ecosystem",
        createdAt: new Date().toISOString(),
      });
      if (session.user?.email) {
        const current = readStoredAccounts();
        const email = session.user.email.trim().toLowerCase();
        if (current[email]) {
          current[email].avatarUrl = avatarUrl;
          localStorage.setItem(ACCOUNT_SESSIONS_KEY, JSON.stringify(current));
          setStoredAccounts(current);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel atualizar a imagem.";
      setAvatarError(message);
    } finally {
      setAvatarUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const navigateFromMenu = (href: string) => {
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    if (typeof window !== "undefined") {
      window.location.assign(href);
    } else {
      router.push(href);
    }
  };

  const openSettingsModal = (section: SettingsSectionKey = "geral") => {
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    setSettingsInitialSection(section);
    setSettingsModalOpen(true);
  };

  const handleSwitchAccount = async (account: StoredAccount) => {
    const normalized = account.email?.trim().toLowerCase();
    if (!normalized) return;
    if (switchingAccountEmail) return;
    setSwitchingAccountEmail(normalized);
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    try {
      if (account.accessToken && account.refreshToken && typeof window !== "undefined") {
        const { data, error } = await setSessionWithTimeout(account.accessToken, account.refreshToken);
        if (!error && data?.session) {
          saveAccountSession(data.session);
          if (typeof window !== "undefined") {
            localStorage.removeItem("loginEmailHint");
          }
          const target = await resolvePostLoginTarget(returnTo, data.session.access_token);
          router.replace(target);
          return;
        }
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("loginEmailHint", normalized);
      }
      router.push(buildAccessEmailHref(normalized));
    } finally {
      setSwitchingAccountEmail(null);
    }
  };

  const handleAddExternalAccount = async () => {
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    await supabase.auth.signOut();
    router.push(buildAccessEmailHref());
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    try {
      await supabase.auth.signOut();
    } finally {
      if (typeof window !== "undefined") {
        window.location.assign("/knexit-workspace/acesso");
      } else {
        router.push("/knexit-workspace/acesso");
      }
    }
  };

  if (!activeAvatar) return null;
  const profileDisplayName =
    activeAvatar.name?.trim() ||
    (activeAvatar.email ? formatAccountName(activeAvatar.email) : "Conta Knex");
  const profileHandleRaw = (activeAvatar.email?.split("@")[0] ?? profileDisplayName)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const profileHandle = `@${profileHandleRaw || "knexit"}`;

  return (
    <div className="relative flex items-center justify-end" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-[3px]"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%), conic-gradient(#1E6DDC 0 25%, #26C281 25% 50%, #F59E0B 50% 75%, #E02424 75% 100%)",
        }}
        aria-label="Conta"
      >
        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
          {activeAvatar.url ? (
            // Use img to avoid Next Image domain restrictions for dynamic avatars.
            <img
              src={activeAvatar.url}
              alt={activeAvatar.name || "Avatar"}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span>{activeAvatar.initials}</span>
          )}
          {isLoggedIn ? (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-[var(--kx-header)] bg-emerald-400" />
          ) : null}
        </span>
      </button>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />
      {menuOpen ? (
        <div className="absolute right-0 bottom-full mb-3 w-[min(92vw,340px)] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.6)]">
          <div className="relative flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setAccountSwitcherOpen(false);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-white"
              aria-label="Fechar menu"
            >
              x
            </button>
          </div>

          <div className="mt-1 rounded-3xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-3 px-1">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-[2px]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%), conic-gradient(#1E6DDC 0 25%, #26C281 25% 50%, #F59E0B 50% 75%, #E02424 75% 100%)",
                }}
              >
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white text-xs font-semibold text-slate-700">
                  {activeAvatar.url ? (
                    <img
                      src={activeAvatar.url}
                      alt={activeAvatar.name || "Avatar"}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    activeAvatar.initials
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[27px] leading-7 font-semibold text-slate-900">{profileDisplayName}</p>
                <p className="truncate text-sm text-slate-500">{profileHandle}</p>
              </div>
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleAvatarSelect}
                  disabled={avatarUploading}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Atualizar foto"
                >
                  <CameraIcon />
                </button>
              ) : null}
            </div>
            <div className="mt-3 h-px bg-slate-200" />
            <div className="mt-2 space-y-0.5">
              <button
                type="button"
                onClick={() => navigateFromMenu("/knexit-workspace/precos")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-white"
              >
                <MenuUpgradeIcon />
                <span>Fazer upgrade do plano</span>
              </button>
              <button
                type="button"
                onClick={() => openSettingsModal("personalizacao")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-white"
              >
                <MenuTuneIcon />
                <span>Personalizacao</span>
              </button>
              <button
                type="button"
                onClick={() => openSettingsModal("geral")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-white"
              >
                <MenuSettingsIcon />
                <span>Configuracoes</span>
              </button>
              <div className="my-1 h-px bg-slate-200" />
              <button
                type="button"
                onClick={() => navigateFromMenu("/lobby/recursos/faq")}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-white"
              >
                <span className="flex items-center gap-3">
                  <MenuHelpIcon />
                  <span>Ajuda</span>
                </span>
                <MenuChevronRightIcon />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-white"
              >
                <ExitIcon />
                <span>Sair</span>
              </button>
            </div>
            {currentDomain ? (
              <p className="mt-2 px-3 text-[11px] text-slate-500">Gerenciado por {currentDomain}</p>
            ) : null}
          </div>

          {avatarError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {avatarError}
            </div>
          ) : null}
          {switchingAccountEmail ? (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Acessando {switchingAccountEmail}...
            </div>
          ) : null}

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/80">
            {((!isLoggedIn && loggedOutExtraAccounts.length > 0) || (isLoggedIn && switcherAccounts.length > 0)) && (
              <button
                type="button"
                onClick={() => setAccountSwitcherOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-semibold text-slate-700"
              >
                <span>{accountSwitcherOpen ? "Ocultar mais contas" : "Mostrar mais contas"}</span>
                <ChevronIcon className={`h-4 w-4 transition ${accountSwitcherOpen ? "rotate-180" : ""}`} />
              </button>
            )}

            <div className={`${accountSwitcherOpen ? "border-t border-slate-200 bg-white" : ""}`}>
              {isLoggedIn ? (
                <>
                  {accountSwitcherOpen ? (
                    <>
                      <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-[2px]"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%), conic-gradient(#1E6DDC 0 25%, #26C281 25% 50%, #F59E0B 50% 75%, #E02424 75% 100%)",
                          }}
                        >
                          <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-slate-700">
                            {activeAvatar.url ? (
                              <img
                                src={activeAvatar.url}
                                alt={activeAvatar.name || "Avatar"}
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              activeAvatar.initials
                            )}
                          </span>
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-slate-800">
                            {activeAvatar.name || "Conta atual"}
                          </span>
                          <span className="block text-[11px] text-slate-500">{activeAvatar.email || "Conta"}</span>
                        </span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Padrao
                        </span>
                      </div>

                      {switcherAccounts.map((account) => (
                        <button
                          key={account.email}
                          type="button"
                          onClick={() => handleSwitchAccount(account)}
                          disabled={Boolean(switchingAccountEmail)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-[2px]"
                            style={{
                              backgroundImage:
                                "radial-gradient(circle at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%), conic-gradient(#1E6DDC 0 25%, #26C281 25% 50%, #F59E0B 50% 75%, #E02424 75% 100%)",
                            }}
                          >
                            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-slate-700">
                              {account.avatarUrl ? (
                                <img
                                  src={account.avatarUrl}
                                  alt={account.name ?? account.email}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                account.email?.charAt(0).toUpperCase()
                              )}
                            </span>
                          </span>
                          <span className="flex-1">
                            <span className="block text-sm font-semibold text-slate-800">
                              {account.name || formatAccountName(account.email)}
                            </span>
                            <span className="block text-[11px] text-slate-500">{account.email}</span>
                          </span>
                        </button>
                      ))}
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="bg-white">
                    {loggedOutPrimaryAccounts.map((account) => (
                      <button
                        key={account.email}
                        type="button"
                        onClick={() => handleSwitchAccount(account)}
                        disabled={Boolean(switchingAccountEmail)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-[2px]"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%), conic-gradient(#1E6DDC 0 25%, #26C281 25% 50%, #F59E0B 50% 75%, #E02424 75% 100%)",
                          }}
                        >
                          <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-slate-700">
                            {account.avatarUrl ? (
                              <img
                                src={account.avatarUrl}
                                alt={account.name ?? account.email}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              account.email?.charAt(0).toUpperCase()
                            )}
                          </span>
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-slate-800">
                            {account.name || formatAccountName(account.email)}
                          </span>
                          <span className="block text-[11px] text-slate-500">{account.email}</span>
                        </span>
                      </button>
                    ))}

                    {accountSwitcherOpen &&
                      loggedOutExtraAccounts.map((account) => (
                        <button
                          key={account.email}
                          type="button"
                          onClick={() => handleSwitchAccount(account)}
                          disabled={Boolean(switchingAccountEmail)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-[2px]"
                            style={{
                              backgroundImage:
                                "radial-gradient(circle at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%), conic-gradient(#1E6DDC 0 25%, #26C281 25% 50%, #F59E0B 50% 75%, #E02424 75% 100%)",
                            }}
                          >
                            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-slate-700">
                              {account.avatarUrl ? (
                                <img
                                  src={account.avatarUrl}
                                  alt={account.name ?? account.email}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                account.email?.charAt(0).toUpperCase()
                              )}
                            </span>
                          </span>
                          <span className="flex-1">
                            <span className="block text-sm font-semibold text-slate-800">
                              {account.name || formatAccountName(account.email)}
                            </span>
                            <span className="block text-[11px] text-slate-500">{account.email}</span>
                          </span>
                        </button>
                      ))}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={handleAddExternalAccount}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  +
                </span>
                <span className="text-sm font-semibold text-slate-700">Adicionar outra conta</span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-slate-500">
            <span>Politica de Privacidade</span>
            <span className="h-1 w-1 rounded-full bg-slate-400" />
            <span>Termos de Servico</span>
          </div>
        </div>
      ) : null}
      <SettingsFloatingModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        initialSection={settingsInitialSection}
      />
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-600" aria-hidden="true">
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

function MenuUpgradeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-700" aria-hidden="true">
      <path
        d="m12 4 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L12 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuTuneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-700" aria-hidden="true">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h4M12 12h8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function MenuSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-700" aria-hidden="true">
      <path
        d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m19.4 13.2.1-2.4-2.1-.7a5.9 5.9 0 0 0-.6-1.4l1.1-1.9-1.7-1.7-1.9 1.1c-.5-.2-1-.4-1.5-.5l-.7-2.2h-2.4l-.7 2.2c-.5.1-1 .3-1.5.5L6 5.1 4.3 6.8l1.1 1.9c-.3.4-.5.9-.6 1.4l-2.1.7.1 2.4 2.1.7c.1.5.3 1 .6 1.4l-1.1 1.9L6 18.9l1.9-1.1c.5.2 1 .4 1.5.5l.7 2.2h2.4l.7-2.2c.5-.1 1-.3 1.5-.5l1.9 1.1 1.7-1.7-1.1-1.9c.3-.4.5-.9.6-1.4l2.1-.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuHelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-700" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.4 9.7a2.6 2.6 0 1 1 4.5 1.8c-.8.8-1.4 1.2-1.4 2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" />
    </svg>
  );
}

function MenuChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" aria-hidden="true">
      <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

