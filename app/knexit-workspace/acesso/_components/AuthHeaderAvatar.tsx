"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import type { Session, User } from "@supabase/supabase-js";

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
  const [avatar, setAvatar] = useState<AvatarState | null>(null);
  const [fallbackAvatar, setFallbackAvatar] = useState<AvatarState | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [storedAccounts, setStoredAccounts] = useState<Record<string, StoredAccount>>({});
  const [recentAccounts, setRecentAccounts] = useState<string[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const buildAccessEmailHref = (email?: string) => {
    const params = new URLSearchParams(searchParams?.toString());
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
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
      setAvatar((prev) => (prev ? { ...prev, url: avatarUrl } : prev));
      setFallbackAvatar((prev) => (prev ? { ...prev, url: avatarUrl } : prev));
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

  const handleSwitchAccount = async (account: StoredAccount) => {
    const normalized = account.email?.trim().toLowerCase();
    if (!normalized) return;
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    if (account.accessToken && account.refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: account.accessToken,
        refresh_token: account.refreshToken,
      });
      if (!error && data?.session) {
        saveAccountSession(data.session);
        router.push(buildAccessEmailHref(normalized));
        return;
      }
    }
    router.push(buildAccessEmailHref(normalized));
  };

  const handleAddExternalAccount = async () => {
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    await supabase.auth.signOut();
    router.push(buildAccessEmailHref());
  };

  const handleSignOutAll = async () => {
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACCOUNT_SESSIONS_KEY);
      localStorage.removeItem(RECENT_ACCOUNTS_KEY);
    }
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

  const greetingName = activeAvatar.name ? activeAvatar.name.split(" ")[0] : "amigo";

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
        <div className="absolute right-0 top-full mt-3 w-[min(92vw,340px)] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.6)]">
          <div className="relative flex items-center justify-end">
            <div className="pointer-events-none absolute left-1/2 w-full -translate-x-1/2 px-8 text-center">
              <p className="text-xs font-semibold text-slate-700">{activeAvatar.email || "Conta"}</p>
              {currentDomain ? (
                <p className="text-[11px] text-slate-500">Gerenciado por {currentDomain}</p>
              ) : null}
            </div>
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

          <div className="mt-4 flex flex-col items-center text-center">
            <div className="relative">
              <div
                className="h-20 w-20 rounded-full p-[3px]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%), conic-gradient(#1E6DDC 0 25%, #26C281 25% 50%, #F59E0B 50% 75%, #E02424 75% 100%)",
                }}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-2xl font-semibold text-slate-700">
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
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleAvatarSelect}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Atualizar foto"
                >
                  <CameraIcon />
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-900">Ola, {greetingName}!</p>
            {isLoggedIn ? (
              <p className="mt-1 text-[11px] font-semibold text-emerald-600">Logado</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">Sessao inativa</p>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                if (typeof window !== "undefined") {
                  window.location.assign("/knexit-workspace/conta");
                } else {
                  router.push("/knexit-workspace/conta");
                }
              }}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-blue-700 hover:bg-slate-50"
            >
              Gerenciar sua Conta Knex
            </button>
          </div>

          {avatarError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {avatarError}
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
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
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
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
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
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
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

              <button
                type="button"
                onClick={handleSignOutAll}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-rose-600 hover:bg-rose-50/40"
              >
                <ExitIcon />
                <span className="text-sm font-semibold">Sair de todas as contas</span>
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

