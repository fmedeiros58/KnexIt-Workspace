"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  name: string;
  email: string;
  initials: string;
  imageUrl: string;
};

const FALLBACK_PROFILE: Profile = {
  name: "Conta de administrador",
  email: "Use uma conta do Admin Console",
  initials: "AC",
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
  const source = name || email || "Admin";
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (source.includes("@")) {
    return source.slice(0, 2).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function buildProfile(user: User | null): Profile {
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

export default function AdminLoginClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(FALLBACK_PROFILE);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setHasUser(Boolean(data.user));
      setProfile(buildProfile(data.user ?? null));
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasUser(Boolean(session?.user));
      setProfile(buildProfile(session?.user ?? null));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const accounts = useMemo(() => (hasUser ? [profile] : []), [hasUser, profile]);

  const handleOtherAccount = () => {
    router.push("/admin/login/outra");
  };

  const handleSelectAccount = () => {
    router.push("/admin");
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-100 font-[family:Arial,Helvetica,sans-serif]">
      <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-[12px] shadow-sm">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-700">KnexIT</div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-blue-50 px-3 py-3 text-sm text-slate-700">
            <InfoIcon />
            <div>
              <p className="font-semibold">Faça login com uma conta de administrador</p>
              <p className="text-xs text-slate-600">
                Para fazer login em admin.knexit.com, use uma conta de administrador em um serviço gerenciado do KnexIt, como o KnexIt Workspace.
              </p>
            </div>
          </div>

          <h1 className="mt-6 text-xl font-semibold text-slate-900">Escolher uma conta</h1>

          <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {accounts.length > 0 ? (
              accounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={handleSelectAccount}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {account.imageUrl ? (
                        <Image
                          src={account.imageUrl}
                          alt={account.name}
                          width={36}
                          height={36}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        account.initials
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                      <p className="text-xs text-slate-500">{account.email}</p>
                    </div>
                  </div>
                  <ChevronIcon />
                </button>
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-slate-500">Nenhuma conta encontrada.</div>
            )}

            <button
              type="button"
              onClick={handleOtherAccount}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <UserIcon />
              Usar outra conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 text-blue-600" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 10v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-600" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 19.5c1.8-3.2 4.8-4.8 7.5-4.8s5.7 1.6 7.5 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
