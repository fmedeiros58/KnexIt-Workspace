"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { identitySupabase } from "@/lib/identitySupabaseClient";

const supabase = identitySupabase();

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

type AccessPageClientProps = {
  oauthRedirectUrl?: string | null;
  initialReturnTo?: string | null;
};

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;
const normalizeAllowedDomain = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
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

export default function KnexitWorkspaceAccessPage({
  oauthRedirectUrl = null,
  initialReturnTo = null,
}: AccessPageClientProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<UserProfile>(FALLBACK_PROFILE);
  const [loginEmail, setLoginEmail] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "done">("idle");
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [authIntent, setAuthIntent] = useState<"default" | "recovery">("default");
  const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const isStepTwo = emailExists !== null;

  const allowedDomain = normalizeAllowedDomain(process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || "");
  const isAllowedEmail = (email: string) => {
    if (!email) return false;
    if (!allowedDomain) return true;
    return email.endsWith(`@${allowedDomain}`);
  };

  const returnTo = useMemo(() => {
    if (!initialReturnTo) return "/knexit-workspace";
    try {
      return decodeURIComponent(initialReturnTo);
    } catch {
      return initialReturnTo;
    }
  }, [initialReturnTo]);

  const oauthRedirect = useMemo(() => {
    if (oauthRedirectUrl) return oauthRedirectUrl;
    const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000";
    return `${origin}/auth/callback`;
  }, [oauthRedirectUrl]);

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

  const resetFlow = () => {
    setLookupStatus("idle");
    setEmailExists(null);
    setPassword("");
    setPasswordConfirm("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setOtpCode("");
    setOtpSent(false);
    setOtpEnabled(false);
    setOtpVerified(false);
    setAuthIntent("default");
    setResendCooldown(0);
    setError(null);
    setNotice(null);
  };

  function handleAddAccount() {
    resetFlow();
    setLoginEmail("");
  }

  async function handleSignOut() {
    setMenuOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("loginEmailHint");
    }
    await supabase.auth.signOut();
    router.push("/login");
  }

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
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("Faça login para atualizar a imagem.");
      }
      const userId = userData.user.id;
      const filePath = `${userId}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
      if (uploadError) {
        throw uploadError;
      }
      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = `${publicData.publicUrl}?t=${Date.now()}`;
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
      setProfile((prev) => ({ ...prev, imageUrl: avatarUrl }));
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

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const ensureAllowedEmail = (email: string) => {
    if (!EMAIL_REGEX.test(email)) {
      setError("Informe um e-mail válido.");
      return false;
    }
    if (!isAllowedEmail(email)) {
      setError("E-mail não autorizado para acessar o KnexIT Workspace.");
      return false;
    }
    return true;
  };

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setOtpSent(false);
    setOtpCode("");
    setPassword("");
    setPasswordConfirm("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setOtpEnabled(false);
    setOtpVerified(false);
    setAuthIntent("default");
    setResendCooldown(0);
    const email = loginEmail.trim().toLowerCase();
    setLoginEmail(email);
    if (!ensureAllowedEmail(email)) return;
    setLookupStatus("loading");
    const res = await fetch("/api/auth/lookup-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setError(payload?.message ?? "Falha ao validar o e-mail.");
      setLookupStatus("idle");
      return;
    }
    const payload = (await res.json().catch(() => ({}))) as { exists?: boolean };
    setEmailExists(Boolean(payload?.exists));
    setLookupStatus("done");
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    setOtpSent(false);
    setOtpCode("");
    setPassword("");
    setPasswordConfirm("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setOtpVerified(false);
    setResendCooldown(0);
    const email = loginEmail.trim().toLowerCase();
    setLoginEmail(email);
    if (!ensureAllowedEmail(email)) return;
    setLookupStatus("loading");
    const res = await fetch("/api/auth/lookup-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setError(payload?.message ?? "Falha ao validar o e-mail.");
      setLookupStatus("idle");
      return;
    }
    const payload = (await res.json().catch(() => ({}))) as { exists?: boolean };
    if (!payload?.exists) {
      setError("E-mail não encontrado.");
      setLookupStatus("done");
      return;
    }
    setEmailExists(true);
    setLookupStatus("done");
    setOtpEnabled(true);
    setAuthIntent("recovery");
    await handleRequestOtp("recovery");
  };

  const handlePasswordAuth = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (emailExists === null) {
      setError("Confirme seu e-mail antes de continuar.");
      return;
    }
    const email = loginEmail.trim().toLowerCase();
    if (!ensureAllowedEmail(email)) return;
    if (!password) {
      setError("Informe sua senha.");
      return;
    }
    if (!passwordConfirm) {
      setError("Confirme sua senha.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setPasswordLoading(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("postAuthRedirect", returnTo);
    }
    if (emailExists) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setPasswordLoading(false);
        setError(error.message);
        return;
      }
      await supabase.auth.signOut();
    }
    setPasswordLoading(false);
    setOtpEnabled(true);
    await handleRequestOtp(emailExists ? "magiclink" : "signup");
  };

  const handleRequestOtp = async (typeOverride?: "magiclink" | "signup" | "recovery") => {
    setError(null);
    setNotice(null);
    const email = loginEmail.trim().toLowerCase();
    if (!ensureAllowedEmail(email)) return;
    const otpType =
      typeOverride ?? (authIntent === "recovery" ? "recovery" : emailExists ? "magiclink" : "signup");
    if (otpType === "signup" && !password) {
      setError("Informe sua senha para criar a conta.");
      return;
    }
    setOtpLoading(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("postAuthRedirect", returnTo);
    }
    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        type: otpType,
        ...(otpType === "signup" ? { password } : {}),
      }),
    });
    setOtpLoading(false);
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setError(payload?.message ?? "Falha ao enviar código.");
      return;
    }
    setOtpSent(true);
    setOtpCode("");
    setResendCooldown(30);
    setNotice("Código de 6 dígitos enviado para seu e-mail.");
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setNotice(null);
    if (emailExists === null) {
      setError("Confirme seu e-mail antes de continuar.");
      return;
    }
    const email = loginEmail.trim().toLowerCase();
    if (!ensureAllowedEmail(email)) return;
    if (!OTP_REGEX.test(otpCode)) {
      setError("Informe o código de 6 dígitos.");
      return;
    }
    setVerifyLoading(true);
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        token: otpCode,
        type: authIntent === "recovery" ? "recovery" : emailExists ? "magiclink" : "signup",
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      message?: string;
      session?: { access_token?: string; refresh_token?: string };
    };
    setVerifyLoading(false);
    if (!res.ok) {
      setError(payload?.message ?? "Falha ao validar código.");
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
      setError("Não foi possível autenticar. Tente novamente.");
      return;
    }
    if (authIntent === "recovery") {
      setOtpVerified(true);
      setNotice("C?digo confirmado. Defina uma nova senha.");
      return;
    }
    router.replace(returnTo);
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!newPassword || !newPasswordConfirm) {
      setError("Informe e confirme a nova senha.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setResetLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setResetLoading(false);
    if (updateError) {
      setError("Não foi possível atualizar a senha. Tente novamente.");
      return;
    }
    router.replace(returnTo);
  };

  const otpDigits = useMemo(() => {
    const padded = `${otpCode}`.padEnd(6, " ");
    return padded.slice(0, 6).split("");
  }, [otpCode]);

  const handleOtpChange =
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const digit = event.target.value.replace(/\D/g, "").slice(-1);
      const next = otpDigits.map((value) => (value === " " ? "" : value));
      next[index] = digit;
      const joined = next.join("").slice(0, 6);
      setOtpCode(joined);
      if (digit && index < 5) {
        otpInputsRef.current[index + 1]?.focus();
      }
    };

  const handleOtpKeyDown =
    (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace") {
        const current = otpDigits[index];
        if (!current && index > 0) {
          otpInputsRef.current[index - 1]?.focus();
        }
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

  const handleOAuth = async (provider: "google" | "azure" | "facebook") => {
    setError(null);
    setNotice(null);
    if (typeof window !== "undefined") {
      localStorage.setItem("postAuthRedirect", returnTo);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: oauthRedirect },
    });
    if (error) {
      setError(error.message);
    }
  };

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

        <header
          className="relative z-40 border-b border-white/20 backdrop-blur"
          style={{ backgroundColor: "rgba(62, 143, 163, 0.85)" }}
        >
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
                </button>
                <button
                  type="button"
                  onClick={handleAvatarSelect}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow disabled:opacity-60"
                  aria-label="Atualizar foto"
                >
                  <CameraIcon />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-3 w-[min(92vw,320px)] rounded-3xl border border-slate-200 bg-[#eef3f8] p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.6)]"
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
                        <button
                          type="button"
                          onClick={handleAvatarSelect}
                          disabled={avatarUploading}
                          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow disabled:opacity-60"
                          aria-label="Atualizar foto"
                        >
                          <CameraIcon />
                        </button>
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

                    {avatarError && (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {avatarError}
                      </div>
                    )}
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

        <div className="relative z-10 flex min-h-[calc(100dvh-88px)] items-center">
          <div
            className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${isStepTwo ? "py-6 md:py-8" : "py-8 md:py-10"}`}
          >
            <div
              className={`grid items-center lg:grid-cols-[minmax(0,1fr),minmax(0,420px)] ${
                isStepTwo ? "gap-6" : "gap-8"
              }`}
            >
              <section className="space-y-4 fade-up text-center lg:text-left">
              <div className="mx-auto w-full max-w-md text-left lg:ml-6">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-200">Acesso Knexspace One</p>
                <h1 className="text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-tight text-slate-900">
                  Vamos começar
                </h1>
                <p className="mt-2 text-[clamp(1rem,1.2vw,1.1rem)] text-slate-700">
                  Centralize seus produtos, permissões e equipes em uma única conta. Escolha como você quer entrar no
                  KnexIT Workspace.
                </p>
              </div>
              <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-[#f3f6fb] p-4 text-left shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)] lg:mx-0 lg:ml-6">
                <p className="text-sm text-slate-700">
                  Comece do zero com uma nova conta para um e-mail personalizado, como voce@suaempresa.com
                </p>
                <Link
                  href="/knexit-workspace/acesso/novo"
                  className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#0f5bd6] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 no-underline hover:no-underline"
                >
                  Crie uma nova conta
                </Link>
              </div>
            </section>

            <section
              className={`fade-up flex flex-col justify-center ${
                isStepTwo ? "space-y-3" : "space-y-4"
              }`}
            >
              <div
                className={`rounded-3xl border border-[var(--kx-border)] bg-[#f1f6fb] shadow-[0_24px_50px_-30px_rgba(15,23,42,0.4)] ${
                  isStepTwo ? "p-4 sm:p-5" : "p-5 sm:p-6"
                } ${isStepTwo ? "scale-[0.98] origin-center" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Entrar ou criar conta</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Digite seu e-mail. O Knexspace mostra as opções corretas para continuar.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Knex ID
                </span>
              </div>

              {!isStepTwo ? (
                <>
                  <form onSubmit={handleLookup} className="mt-5 space-y-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      E-mail
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        placeholder="voce@empresa.com"
                        className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={lookupStatus === "loading" || !loginEmail}
                      className="inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[var(--kx-primary)] px-4 py-3 text-center text-sm font-semibold leading-snug text-white shadow-lg shadow-blue-500/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {lookupStatus === "loading" ? "Verificando..." : "Continuar"}
                    </button>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={!loginEmail || lookupStatus === "loading"}
                        className="text-xs font-semibold text-blue-700 hover:underline disabled:text-slate-400"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 rounded-2xl bg-[#f1f6fb] p-4">
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-slate-200" />
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ou entre com</p>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                    <div className="mt-4 grid justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOAuth("google")}
                        className="inline-flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <GoogleIcon className="h-5 w-5" />
                        Entrar com Google
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOAuth("azure")}
                        className="inline-flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <MicrosoftIcon className="h-5 w-5" />
                        Entrar com Microsoft
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOAuth("facebook")}
                        className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166fe5]"
                      >
                        <FacebookIcon className="h-5 w-5" />
                        Entrar com Facebook
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                  <span>
                    {emailExists ? "Conta encontrada" : "E-mail novo"}: <strong>{loginEmail}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="text-blue-700 font-semibold hover:underline"
                  >
                    Alterar e-mail
                  </button>
                </div>
              )}

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              {notice ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  {notice}
                </div>
              ) : null}

              {isStepTwo && (
                <div className="mt-5 space-y-4">
                  {authIntent != "recovery" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {emailExists ? "Entrar com senha" : "Criar conta com senha"}
                      </p>
                      <form onSubmit={handlePasswordAuth} className="mt-3 space-y-3">
                        <label className="block text-sm text-slate-700">
                          Senha
                          <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Digite sua senha"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                            autoComplete={emailExists ? "current-password" : "new-password"}
                            required
                          />
                        </label>
                        <label className="block text-sm text-slate-700">
                          Confirmar senha
                          <input
                            type="password"
                            value={passwordConfirm}
                            onChange={(event) => setPasswordConfirm(event.target.value)}
                            placeholder="Repita sua senha"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                            autoComplete={emailExists ? "current-password" : "new-password"}
                            required
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={passwordLoading || !password}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {passwordLoading
                            ? "Processando..."
                            : emailExists
                              ? "Entrar com senha"
                              : "Criar conta"}
                        </button>
                      </form>
                    </div>
                  )}

                  {otpEnabled && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {authIntent == "recovery"
                            ? "Confirmar código de recuperação"
                            : "Receber código de 6 dígitos"}
                        </p>
                        <span className="text-[11px] font-semibold text-blue-700">OTP</span>
                      </div>
                      <div className="mt-3 space-y-3">
                        {otpSent ? (
                          <>
                            <div className="space-y-2" onPaste={handleOtpPaste}>
                              <p className="text-sm text-slate-700">C?digo</p>
                              <div className="grid grid-cols-6 gap-2">
                                {otpDigits.map((digit, index) => (
                                  <input
                                    key={`otp-${index}`}
                                    ref={(el) => {
                                      otpInputsRef.current[index] = el;
                                    }}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={digit === " " ? "" : digit}
                                    onChange={handleOtpChange(index)}
                                    onKeyDown={handleOtpKeyDown(index)}
                                    className="h-12 w-full rounded-xl border border-slate-300 bg-white text-center text-lg font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                                  />
                                ))}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleVerifyOtp}
                              disabled={verifyLoading || otpCode.length !== 6}
                              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {verifyLoading ? "Validando..." : "Confirmar código"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRequestOtp()}
                            disabled={otpLoading}
                            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            {otpLoading ? "Enviando..." : "Enviar código"}
                          </button>
                        )}
                        {otpSent && (
                          <button
                            type="button"
                            onClick={() => handleRequestOtp()}
                            disabled={otpLoading || resendCooldown > 0}
                            className="text-xs font-semibold text-blue-700 hover:underline disabled:text-slate-400"
                          >
                            {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {authIntent == "recovery" && otpVerified && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Defina sua nova senha</p>
                      <form onSubmit={handleResetPassword} className="mt-3 space-y-3">
                        <label className="block text-sm text-slate-700">
                          Nova senha
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="Crie uma nova senha"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                            autoComplete="new-password"
                            required
                          />
                        </label>
                        <label className="block text-sm text-slate-700">
                          Confirmar nova senha
                          <input
                            type="password"
                            value={newPasswordConfirm}
                            onChange={(event) => setNewPasswordConfirm(event.target.value)}
                            placeholder="Repita sua nova senha"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                            autoComplete="new-password"
                            required
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={resetLoading || !newPassword}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                        >
                          {resetLoading ? "Salvando..." : "Atualizar senha"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
            </section>
            </div>
          </div>
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

function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.72 1.22 9.22 3.22l6.9-6.9C35.64 1.97 30.13 0 24 0 14.64 0 6.55 5.38 2.58 13.22l8.03 6.23C12.5 13.09 17.77 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.12 24.5c0-1.64-.15-3.21-.43-4.73H24v9.02h12.43c-.54 2.91-2.14 5.37-4.57 7.03l7.4 5.74C43.09 37.09 46.12 31.29 46.12 24.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.61 28.45c-.49-1.48-.77-3.06-.77-4.7 0-1.64.28-3.22.77-4.7l-8.03-6.23C.92 16.36 0 20.11 0 23.75c0 3.64.92 7.39 2.58 10.93l8.03-6.23z"
      />
      <path
        fill="#34A853"
        d="M24 47.5c6.13 0 11.64-2.02 15.52-5.5l-7.4-5.74c-2.06 1.38-4.7 2.2-8.12 2.2-6.23 0-11.5-3.59-13.39-8.71l-8.03 6.23C6.55 42.62 14.64 47.5 24 47.5z"
      />
    </svg>
  );
}

function MicrosoftIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

function FacebookIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M15.5 8.5h-2c-.35 0-.5.15-.5.5V11h2.5l-.35 2.5H13V20h-2.6v-6.5H8.5V11h1.9V8.7C10.4 6.9 11.5 6 13.4 6c.9 0 1.7.1 2.1.1v2.4z"
      />
    </svg>
  );
}
