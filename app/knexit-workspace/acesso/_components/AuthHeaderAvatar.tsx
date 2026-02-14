"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import type { User } from "@supabase/supabase-js";

const supabase = identitySupabase();

type AvatarState = {
  url: string;
  initials: string;
  name?: string;
  email?: string;
};

const getInitials = (name: string, email: string) => {
  const source = name || email || "Knex";
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (source.includes("@")) return source.slice(0, 2).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

type StoredAccount = {
  email: string;
  name?: string;
  avatarUrl?: string;
  lastUsed?: string;
};

const RECENT_ACCOUNTS_KEY = "knex_recent_accounts";
const ACCOUNT_SESSIONS_KEY = "knex_account_sessions";

const readRecentAccounts = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => value.includes("@"));
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
  const [avatar, setAvatar] = useState<AvatarState | null>(null);
  const [fallbackAvatar, setFallbackAvatar] = useState<AvatarState | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAvatar(resolveAvatarState(data.user ?? null));
      setIsLoggedIn(Boolean(sessionData.session?.user));
    };
    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAvatar(resolveAvatarState(session?.user ?? null));
      setIsLoggedIn(Boolean(session?.user));
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

  const activeAvatar = useMemo(() => avatar ?? fallbackAvatar, [avatar, fallbackAvatar]);

  if (!activeAvatar) return null;

  return (
    <div className="relative flex items-center justify-end" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-xs font-semibold text-white"
        aria-label="Conta"
      >
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
      </button>
      {menuOpen ? (
        <div className="absolute right-0 top-full mt-3 w-64 rounded-2xl border border-white/15 bg-[var(--kx-header)] p-4 text-white shadow-xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">
            {isLoggedIn ? "Conta ativa" : "Conta recente"}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-base font-semibold">
              {activeAvatar.url ? (
                <img
                  src={activeAvatar.url}
                  alt={activeAvatar.name || "Avatar"}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span>{activeAvatar.initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activeAvatar.name || "Knexspace"}</p>
              <p className="truncate text-xs text-white/70">{activeAvatar.email || "Conta sem sess\u00e3o ativa"}</p>
              {isLoggedIn ? (
                <p className="mt-1 text-[11px] font-semibold text-emerald-300">Logado</p>
              ) : (
                <p className="mt-1 text-[11px] text-white/70">Sess\u00e3o inativa</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
