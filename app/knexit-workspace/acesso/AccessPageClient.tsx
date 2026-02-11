"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import Script from "next/script";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
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
  stayOnLogin?: boolean;
};

type AuthMethodAvailability = {
  otp: boolean;
  password: boolean;
  google: boolean;
  facebook: boolean;
};

type AuthMethod = "password" | "otp" | "google" | "facebook";

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
const RECENT_ACCOUNTS_KEY = "knex_recent_accounts";
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

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

const needsOauthVerification = (user: User | null, oauthPending: boolean) => {
  if (!user) return false;
  const appMeta = user.app_metadata as { provider?: string; providers?: string[] } | null;
  const provider = appMeta?.provider ?? "";
  const providers = appMeta?.providers ?? [];
  const identityProviders =
    (user.identities ?? []).map((identity) => identity.provider).filter(Boolean) ?? [];
  const hasOauthProvider =
    provider === "google" ||
    provider === "facebook" ||
    providers.includes("google") ||
    providers.includes("facebook") ||
    identityProviders.includes("google") ||
    identityProviders.includes("facebook");
  if (!hasOauthProvider && !oauthPending) return false;
  const metadata = user.user_metadata as { email_verified_by_code_at?: string } | null;
  return !metadata?.email_verified_by_code_at;
};

const needsEmailVerification = (user: User | null) => {
  if (!user) return false;
  const metadata = user.user_metadata as { email_verified_by_code_at?: string } | null;
  return !metadata?.email_verified_by_code_at;
};

const getOauthProvider = (user: User | null): "google" | "facebook" | null => {
  if (!user) return null;
  const appMeta = user.app_metadata as { provider?: string; providers?: string[] } | null;
  const provider = appMeta?.provider ?? "";
  if (provider === "google" || provider === "facebook") return provider;
  const providers = appMeta?.providers ?? [];
  if (providers.includes("google")) return "google";
  if (providers.includes("facebook")) return "facebook";
  const identityProviders =
    (user.identities ?? []).map((identity) => identity.provider).filter(Boolean) ?? [];
  if (identityProviders.includes("google")) return "google";
  if (identityProviders.includes("facebook")) return "facebook";
  return null;
};

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
  const isWebView =
    (isAndroid && /wv|Version\/\d+/.test(ua)) ||
    (isIos && !/Safari/i.test(ua)) ||
    /FBAN|FBAV|Instagram|Line|Twitter|Snapchat|TikTok|WhatsApp/i.test(ua);
  return isWebView;
};

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
  stayOnLogin = false,
}: AccessPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<UserProfile>(FALLBACK_PROFILE);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "done">("idle");
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [availableMethods, setAvailableMethods] = useState<AuthMethodAvailability | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<"login" | "signup" | "oauth_verify" | "recovery" | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [authIntent, setAuthIntent] = useState<"default" | "recovery">("default");
  const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const emailVerifySentRef = useRef(false);
  const [oauthPending, setOauthPending] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const appBaseUrl = useMemo(() => getAppBaseUrl(), []);
  const isWebView = useMemo(() => isWebViewEnvironment(), []);
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState<string[]>([]);
  const oauthVerifyRequested = useMemo(
    () => (searchParams?.get("verify") ?? "") === "oauth",
    [searchParams],
  );
  const otpVerifyRequested = useMemo(
    () => (searchParams?.get("verify") ?? "") === "otp",
    [searchParams],
  );
  const oauthVerifyActive = oauthVerifyRequested || oauthPending;
  const emailVerifyActive = oauthVerifyActive || otpVerifyRequested;
  const isStepTwo = emailExists !== null;
  const isSignupFlow = emailExists === false;
  const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";
  const useHcaptcha = Boolean(captchaSiteKey);
  const captchaValid = !useHcaptcha || Boolean(captchaToken);
  const passwordsMatch =
    !isSignupFlow || (Boolean(password) && Boolean(passwordConfirm) && password === passwordConfirm);
  const canSubmitPassword = Boolean(
    password && (!isSignupFlow || (passwordConfirm && passwordsMatch && termsAccepted && captchaValid)),
  );

  const logAuth = useCallback((event: string, details?: Record<string, unknown>) => {
    try {
      console.info("[auth]", event, details ?? {});
    } catch {
      // noop
    }
  }, []);

  const readRecentAccounts = useCallback(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECENT_ACCOUNTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) return [];
      const normalized = parsed
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => EMAIL_REGEX.test(value));
      return Array.from(new Set(normalized));
    } catch {
      return [];
    }
  }, []);

  const saveRecentAccount = useCallback(
    (email: string) => {
      if (typeof window === "undefined") return;
      const normalized = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalized)) return;
      const existing = readRecentAccounts();
      const next = [normalized, ...existing.filter((item) => item !== normalized)].slice(0, 6);
      localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(next));
      setRecentAccounts(next);
    },
    [readRecentAccounts],
  );

  const allowedDomain = normalizeAllowedDomain(process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || "");
  const isAllowedEmail = useCallback(
    (email: string) => {
      if (!email) return false;
      if (!allowedDomain) return true;
      return email.endsWith(`@${allowedDomain}`);
    },
    [allowedDomain],
  );

  const returnTo = useMemo(() => {
    const fallback = "/knexit-workspace";
    if (!initialReturnTo) return fallback;
    let decoded = initialReturnTo;
    try {
      decoded = decodeURIComponent(initialReturnTo);
    } catch {
      decoded = initialReturnTo;
    }
    try {
      const base = appBaseUrl || "https://knexspace.com";
      const url = new URL(decoded, base);
      const baseOrigin = new URL(base).origin;
      if (url.origin !== baseOrigin) {
        return fallback;
      }
      const path = url.pathname || "/";
      if (path === "/login" || path.startsWith("/login/") || path.startsWith("/lobby")) {
        return fallback;
      }
      return `${path}${url.search}${url.hash}`;
    } catch {
      if (decoded === "/login" || decoded.startsWith("/login/") || decoded.startsWith("/lobby")) {
        return fallback;
      }
      return decoded;
    }
  }, [appBaseUrl, initialReturnTo]);

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
    url.searchParams.set("returnTo", returnTo);
    return url.toString();
  }, [appBaseUrl, oauthRedirectUrl, returnTo]);

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
    if (!isSignupFlow) {
      setTermsAccepted(false);
      setCaptchaToken("");
      setCaptchaError(null);
      return;
    }
  }, [isSignupFlow]);

  useEffect(() => {
    if (selectedMethod !== "password") return;
    setOtpSent(false);
    setOtpCode("");
    setOtpVerified(false);
    setOtpPurpose(null);
  }, [selectedMethod]);

  useEffect(() => {
    if (!isStepTwo) return;
    if (authIntent === "recovery") {
      setSelectedMethod("otp");
      return;
    }
    if (!availableMethods) return;
    if (selectedMethod && availableMethods[selectedMethod]) return;
    if (availableMethods.password) {
      setSelectedMethod("password");
      return;
    }
    if (availableMethods.otp) {
      setSelectedMethod("otp");
      return;
    }
    if (availableMethods.google) {
      setSelectedMethod("google");
      return;
    }
    if (availableMethods.facebook) {
      setSelectedMethod("facebook");
    }
  }, [authIntent, availableMethods, isStepTwo, selectedMethod]);

  useEffect(() => {
    if (!useHcaptcha || typeof window === "undefined") return;
    (window as any).kxCaptchaSuccess = (token: string) => {
      setCaptchaToken(token);
      setCaptchaError(null);
    };
    (window as any).kxCaptchaExpired = () => {
      setCaptchaToken("");
    };
    (window as any).kxCaptchaError = () => {
      setCaptchaToken("");
      setCaptchaError("Falha ao carregar o captcha.");
    };
    return () => {
      delete (window as any).kxCaptchaSuccess;
      delete (window as any).kxCaptchaExpired;
      delete (window as any).kxCaptchaError;
    };
  }, [useHcaptcha]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = localStorage.getItem("oauthPending");
    if (pending) {
      setOauthPending(true);
    }
  }, []);

  useEffect(() => {
    setRecentAccounts(readRecentAccounts());
  }, [readRecentAccounts]);

  useEffect(() => {
    if (!menuOpen) {
      setAccountSwitcherOpen(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setProfile(buildProfile(data.user ?? null));
      setCurrentUser(data.user ?? null);
    };

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setProfile(buildProfile(session?.user ?? null));
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // browser autocomplete already provides recent emails

  const resetFlow = () => {
    setLookupStatus("idle");
    setEmailExists(null);
    setAvailableMethods(null);
    setSelectedMethod(null);
    setPassword("");
    setPasswordConfirm("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setOtpCode("");
    setOtpSent(false);
    setOtpVerified(false);
    setOtpPurpose(null);
    setAuthIntent("default");
    setResendCooldown(0);
    setError(null);
    setNotice(null);
    setTermsAccepted(false);
    setCaptchaToken("");
    setCaptchaError(null);
  };

  function handleAddAccount() {
    resetFlow();
    setLoginEmail("");
    setAccountSwitcherOpen(false);
  }

  const handleSwitchAccount = async (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    resetFlow();
    setLoginEmail(normalized);
    if (typeof window !== "undefined") {
      localStorage.setItem("loginEmailHint", normalized);
    }
    await supabase.auth.signOut();
  };

  async function handleSignOut() {
    setMenuOpen(false);
    setAccountSwitcherOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("loginEmailHint");
    }
    await supabase.auth.signOut();
    router.push("/knexit-workspace");
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
        throw new Error(payload?.message ?? "Não foi possível atualizar a imagem.");
      }
      const avatarUrl = payload.url;
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

  const resolvePostLoginRedirect = useCallback(async () => {
    if (!returnTo.startsWith("/knexchat")) {
      return returnTo;
    }
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return returnTo;
    try {
      const res = await fetch("/api/knexchat/activation/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json().catch(() => null)) as { activated?: boolean } | null;
      if (res.ok && payload && payload.activated === false) {
        return `/knexchat/activate?returnTo=${encodeURIComponent(returnTo)}`;
      }
    } catch {
      // ignore and fall back
    }
    return returnTo;
  }, [returnTo]);

  const finalizeLogin = useCallback(
    async (source: string) => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data?.session) {
        setError("Não foi possível autenticar. Tente novamente.");
        logAuth("session_missing", { source });
        return;
      }
      const email = data.session.user?.email ?? "";
        if (email && !isAllowedEmail(email)) {
          setError("E-mail não autorizado para acessar o KnexIT Workspace.");
          logAuth("email_not_allowed", { source });
          await supabase.auth.signOut();
          return;
        }
        if (email) {
          saveRecentAccount(email);
        }
        logAuth("session_created", { source });
      const target = await resolvePostLoginRedirect();
      router.replace(target);
    },
      [isAllowedEmail, logAuth, resolvePostLoginRedirect, router, saveRecentAccount],
    );

  useEffect(() => {
    if (stayOnLogin) return;
    if (emailVerifyActive) return;
    let active = true;
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error || !data?.session) return;
      const sessionUser = data.session.user;
      const email = sessionUser?.email ?? "";
      if (email && !isAllowedEmail(email)) {
        setError("E-mail não autorizado para acessar o KnexIT Workspace.");
        await supabase.auth.signOut();
        return;
      }
      const pending =
        oauthPending || (typeof window !== "undefined" && Boolean(localStorage.getItem("oauthPending")));
      if (!pending && typeof window !== "undefined") {
        const hint = localStorage.getItem("oauthPendingEmail");
        if (hint && email && hint.toLowerCase() === email.toLowerCase()) {
          localStorage.setItem("oauthPending", "1");
          setOauthPending(true);
        }
      }
      const pendingResolved =
        oauthPending || (typeof window !== "undefined" && Boolean(localStorage.getItem("oauthPending")));
      const metadata = sessionUser?.user_metadata as { email_verified_by_code_at?: string } | null;
      if (metadata?.email_verified_by_code_at && pendingResolved && typeof window !== "undefined") {
        localStorage.removeItem("oauthPending");
        localStorage.removeItem("oauthPendingEmail");
        setOauthPending(false);
      }
      if (needsEmailVerification(sessionUser)) {
        if (needsOauthVerification(sessionUser, pendingResolved)) {
          if (!pendingResolved && typeof window !== "undefined") {
            localStorage.setItem("oauthPending", "1");
            localStorage.setItem("oauthPendingEmail", email.toLowerCase());
            setOauthPending(true);
          }
          if (!oauthVerifyRequested) {
            const params = new URLSearchParams();
            params.set("returnTo", returnTo);
            if (stayOnLogin) {
              params.set("stay", "1");
            }
            params.set("verify", "oauth");
            router.replace(`/knexit-workspace/acesso?${params.toString()}`);
          }
          return;
        }
        if (!otpVerifyRequested) {
          const params = new URLSearchParams();
          params.set("returnTo", returnTo);
          if (stayOnLogin) {
            params.set("stay", "1");
          }
          params.set("verify", "otp");
          router.replace(`/knexit-workspace/acesso?${params.toString()}`);
        }
        return;
      }
      const target = await resolvePostLoginRedirect();
      router.replace(target);
    };
    checkSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      if (oauthVerifyRequested || otpVerifyRequested) return;
      const email = session.user?.email ?? "";
      if (email && !isAllowedEmail(email)) {
        setError("E-mail não autorizado para acessar o KnexIT Workspace.");
        supabase.auth.signOut();
        return;
      }
      const pending =
        oauthPending || (typeof window !== "undefined" && Boolean(localStorage.getItem("oauthPending")));
      if (!pending && typeof window !== "undefined") {
        const hint = localStorage.getItem("oauthPendingEmail");
        if (hint && email && hint.toLowerCase() === email.toLowerCase()) {
          localStorage.setItem("oauthPending", "1");
          setOauthPending(true);
        }
      }
      const pendingResolved =
        oauthPending || (typeof window !== "undefined" && Boolean(localStorage.getItem("oauthPending")));
      const metadata = session.user?.user_metadata as { email_verified_by_code_at?: string } | null;
      if (metadata?.email_verified_by_code_at && pendingResolved && typeof window !== "undefined") {
        localStorage.removeItem("oauthPending");
        localStorage.removeItem("oauthPendingEmail");
        setOauthPending(false);
      }
      if (needsEmailVerification(session.user)) {
        if (needsOauthVerification(session.user, pendingResolved)) {
          if (!pendingResolved && typeof window !== "undefined") {
            localStorage.setItem("oauthPending", "1");
            localStorage.setItem("oauthPendingEmail", email.toLowerCase());
            setOauthPending(true);
          }
          const params = new URLSearchParams();
          params.set("returnTo", returnTo);
          if (stayOnLogin) {
            params.set("stay", "1");
          }
          params.set("verify", "oauth");
          router.replace(`/knexit-workspace/acesso?${params.toString()}`);
          return;
        }
        if (!otpVerifyRequested) {
          const params = new URLSearchParams();
          params.set("returnTo", returnTo);
          if (stayOnLogin) {
            params.set("stay", "1");
          }
          params.set("verify", "otp");
          router.replace(`/knexit-workspace/acesso?${params.toString()}`);
          return;
        }
        return;
      }
      resolvePostLoginRedirect().then((target) => router.replace(target));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [
    resolvePostLoginRedirect,
    router,
    isAllowedEmail,
    stayOnLogin,
    oauthVerifyRequested,
    otpVerifyRequested,
    emailVerifyActive,
    oauthPending,
    returnTo,
  ]);

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
    setOtpVerified(false);
    setOtpPurpose(null);
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
    const payload = (await res.json().catch(() => ({}))) as {
      exists?: boolean;
      hasPassword?: boolean;
      providers?: { google?: boolean; facebook?: boolean };
      methods?: Partial<AuthMethodAvailability>;
    };
    const exists = Boolean(payload?.exists);
    const passwordAllowed = exists ? Boolean(payload?.hasPassword) : true;
    const fallbackMethods: AuthMethodAvailability = {
      otp: true,
      password: passwordAllowed,
      google: true,
      facebook: true,
    };
    const methods = { ...fallbackMethods, ...(payload?.methods ?? {}) };
    setEmailExists(exists);
    setAvailableMethods(methods);
    setSelectedMethod(null);
    setLookupStatus("done");
    logAuth("lookup_email", { exists, methods });
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
    setAvailableMethods({ otp: true, password: false, google: false, facebook: false });
    setSelectedMethod("otp");
    setLookupStatus("done");
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
    if (!emailExists) {
      if (!passwordConfirm) {
        setError("Confirme sua senha.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("As senhas não coincidem.");
        return;
      }
      if (!termsAccepted) {
        setError("Você precisa aceitar os Termos e Serviços para continuar.");
        return;
      }
      if (!captchaValid) {
        setError("Confirme o captcha para continuar.");
        return;
      }
    }
    setPasswordLoading(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("postAuthRedirect", returnTo);
    }
    if (emailExists) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setPasswordLoading(false);
      if (error) {
        setError(error.message);
        logAuth("login_password_error", { email });
        return;
      }
      logAuth("login_password_success", { email });
      await finalizeLogin("password");
      return;
    }
    setPasswordLoading(false);
    setSelectedMethod("otp");
    await handleRequestOtp("signup");
  };

  const handleRequestOtp = async (
    typeOverride?: "login" | "signup" | "recovery" | "oauth_verify",
    emailOverride?: string,
  ) => {
    setError(null);
    setNotice(null);
    const email = (emailOverride ?? loginEmail).trim().toLowerCase();
    if (!ensureAllowedEmail(email)) return;
    const otpType =
      typeOverride ?? (authIntent === "recovery" ? "recovery" : emailExists ? "login" : "signup");
    if (otpType === "signup" && !password) {
      setError("Informe sua senha para criar a conta.");
      return;
    }
    if (otpType === "signup") {
      if (!termsAccepted) {
        setError("Você precisa aceitar os Termos e Serviços para continuar.");
        return;
      }
      if (!captchaValid) {
        setError("Confirme o captcha para continuar.");
        return;
      }
    }
    setOtpLoading(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("postAuthRedirect", returnTo);
    }
    logAuth("otp_request", { email, flow: otpType });
    setOtpPurpose(otpType);
    const mode =
      otpType === "signup"
        ? "otp_signup"
        : otpType === "recovery"
          ? "otp_recovery"
          : otpType === "oauth_verify"
            ? "otp_oauth_verify"
            : "otp_login";
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        purpose: otpType,
        mode,
        ...(otpType === "signup" ? { password } : {}),
        ...(otpType === "signup" && useHcaptcha ? { captchaToken } : {}),
      }),
    });
    setOtpLoading(false);
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      setError(
        payload?.code === "OTP_KIND_INVALID"
          ? "Não foi possível enviar o código. Tente novamente."
          : payload?.message ?? "Falha ao enviar código.",
      );
      logAuth("otp_request_error", { email, flow: otpType, code: payload?.code ?? "unknown" });
      return;
    }
    setOtpSent(true);
    setOtpCode("");
    setResendCooldown(30);
    setNotice("Código de 6 dígitos enviado para seu e-mail.");
    logAuth("otp_request_success", { email, flow: otpType });
  };

  useEffect(() => {
    if (!emailVerifyActive || emailVerifySentRef.current) return;
    let active = true;
    let timeoutId: number | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const proceed = async (session: Session | null) => {
      if (!active) return;
      if (timeoutId && typeof window !== "undefined") {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      const email = session?.user?.email ?? "";
      if (!email) {
        if (oauthVerifyRequested || otpVerifyRequested) {
          setError("Faça login novamente.");
        }
        return;
      }
      const metadata = session?.user?.user_metadata as { email_verified_by_code_at?: string } | null;
      if (metadata?.email_verified_by_code_at) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("oauthPending");
        }
        setOauthPending(false);
        if (!stayOnLogin) {
          await finalizeLogin("oauth_verify");
        }
        return;
      }
      if (emailVerifySentRef.current) return;
      emailVerifySentRef.current = true;
      if (oauthVerifyActive && typeof window !== "undefined") {
        localStorage.setItem("oauthPending", "1");
        setOauthPending(true);
      }
      setLoginEmail(email.toLowerCase());
      setEmailExists(true);
      setAvailableMethods({ otp: true, password: false, google: false, facebook: false });
      setSelectedMethod("otp");
      setOtpSent(false);
      setOtpCode("");
      setOtpPurpose("oauth_verify");
      await handleRequestOtp("oauth_verify", email);
    };

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data?.session) {
        await proceed(data.session);
        return;
      }
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session || !active) return;
        authSubscription?.unsubscribe();
        authSubscription = null;
        proceed(session);
      });
      authSubscription = authListener?.subscription ?? null;
      if (typeof window !== "undefined") {
        timeoutId = window.setTimeout(() => {
          if (!active) return;
        if (oauthVerifyRequested || otpVerifyRequested) {
          setError("Faça login novamente.");
        }
      }, 4000);
    }
  };

  run();
    return () => {
      active = false;
      if (timeoutId && typeof window !== "undefined") {
        window.clearTimeout(timeoutId);
      }
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [
    finalizeLogin,
    emailVerifyActive,
    oauthVerifyActive,
    oauthVerifyRequested,
    otpVerifyRequested,
    stayOnLogin,
    handleRequestOtp,
  ]);

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
    const flow =
      otpPurpose ??
      (authIntent === "recovery" ? "recovery" : emailExists ? "login" : "signup");
    const mode =
      flow === "signup"
        ? "otp_signup"
        : flow === "recovery"
          ? "otp_recovery"
          : flow === "oauth_verify"
            ? "otp_oauth_verify"
            : "otp_login";
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        token: otpCode,
        code: otpCode,
        purpose: flow,
        mode,
        ...(authIntent !== "recovery" && emailExists === false ? { password } : {}),
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      message?: string;
      session?: { access_token?: string; refresh_token?: string };
    };
    setVerifyLoading(false);
    if (!res.ok) {
      const payloadCode = (payload as { code?: string })?.code;
      setError(
        payloadCode === "OTP_KIND_INVALID"
          ? "Não foi possível validar o código. Tente novamente."
          : payload?.message ?? "Falha ao validar código.",
      );
      logAuth("otp_verify_error", { email, flow, code: payloadCode ?? "unknown" });
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
      logAuth("session_missing", { source: "otp" });
      return;
    }
    if (flow === "recovery") {
      setOtpVerified(true);
      setNotice("Código confirmado. Defina uma nova senha.");
      logAuth("otp_verified_recovery", { email });
      return;
    }
      if (flow === "oauth_verify") {
        logAuth("otp_verified_oauth", { email });
        if (typeof window !== "undefined") {
          localStorage.removeItem("oauthPending");
          localStorage.removeItem("oauthPendingEmail");
        }
        setOauthPending(false);
        await finalizeLogin("oauth_verify");
        return;
      }
    logAuth("otp_verified_login", { email });
    await finalizeLogin("otp");
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

  const showPasswordMethod = Boolean(availableMethods?.password);
  const showOtpMethod = Boolean(availableMethods?.otp);
  const showGoogleMethod = availableMethods ? Boolean(availableMethods.google) : true;
  const showFacebookMethod = availableMethods ? Boolean(availableMethods.facebook) : true;
  const methodGridClass = showPasswordMethod && showOtpMethod ? "grid-cols-2" : "grid-cols-1";
  const oauthProvider = useMemo(() => getOauthProvider(currentUser), [currentUser]);
  const showAddGoogleAccount = oauthProvider === "google";
  const showAddFacebookAccount = oauthProvider === "facebook";
  const switcherAccounts = useMemo(() => {
    const raw = (currentUser?.email ?? profile.email ?? "").trim().toLowerCase();
    const currentEmail = EMAIL_REGEX.test(raw) ? raw : "";
    return recentAccounts.filter((email) => email && email.toLowerCase() !== currentEmail).slice(0, 2);
  }, [currentUser?.email, profile.email, recentAccounts]);

  const handlePasswordToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setShowPassword((prev) => !prev);
  };

  const handlePasswordConfirmToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setShowPasswordConfirm((prev) => !prev);
  };

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

  const handleOAuth = async (
    provider: "google" | "facebook",
    options?: { queryParams?: Record<string, string> },
  ) => {
    setError(null);
    setNotice(null);
    if (typeof window !== "undefined") {
      localStorage.setItem("postAuthRedirect", returnTo);
      localStorage.setItem("oauthEntryPath", "/knexit-workspace/acesso");
      localStorage.setItem("oauthReturnTo", returnTo);
      localStorage.setItem("oauthPending", provider);
      if (loginEmail) {
        localStorage.setItem("oauthPendingEmail", loginEmail.trim().toLowerCase());
      }
      setOauthPending(true);
    }
    logAuth("oauth_start", { provider, webview: isWebView });
    if (isWebView) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: oauthRedirect, skipBrowserRedirect: true, ...options },
      });
      if (error) {
        setError(error.message);
        logAuth("oauth_error", { provider, reason: error.message });
        return;
      }
      if (data?.url && typeof window !== "undefined") {
        logAuth("oauth_external_redirect", { provider });
        const opened = window.open(data.url, "_blank", "noopener,noreferrer");
        if (!opened) {
          window.location.href = data.url;
        }
        return;
      }
      setError("Não foi possível iniciar o login.");
      logAuth("oauth_error", { provider, reason: "missing_url" });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: oauthRedirect, ...options },
    });
    if (error) {
      setError(error.message);
      logAuth("oauth_error", { provider, reason: error.message });
      return;
    }
    logAuth("oauth_redirect", { provider });
  };

  const handleAddGoogleAccount = () =>
    handleOAuth("google", { queryParams: { prompt: "select_account" } });

  const handleAddFacebookAccount = () =>
    handleOAuth("facebook", { queryParams: { auth_type: "reauthenticate" } });

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
              <span className="text-white">Knexspace One</span>
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
                      <Image
                        src={profile.imageUrl}
                        alt={profile.name}
                        width={44}
                        height={44}
                        className="h-full w-full rounded-full object-cover"
                        unoptimized
                      />
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
                    <div className="relative flex items-center justify-end">
                      <p className="pointer-events-none absolute left-1/2 w-full -translate-x-1/2 px-8 text-center text-xs font-semibold text-blue-600">
                        {profile.email}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setAccountSwitcherOpen(false);
                        }}
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
                              <Image
                                src={profile.imageUrl}
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
                          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow disabled:opacity-60"
                          aria-label="Atualizar foto"
                        >
                          <CameraIcon />
                        </button>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-900">Olá, {profile.name}!</p>
                    <Link
                      href="/admin/login"
                      className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline hover:no-underline"
                    >
                      Gerenciar sua conta Knex
                    </Link>
                  </div>

                  <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setAccountSwitcherOpen((prev) => !prev)}
                        className="flex min-h-[44px] items-center justify-center gap-2 px-3 py-3 text-xs font-semibold text-blue-600 hover:bg-slate-50"
                      >
                        <SwitchIcon />
                        Trocar conta
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex min-h-[44px] items-center justify-center gap-2 border-l border-slate-200 px-3 py-3 text-xs font-semibold text-rose-600 hover:bg-rose-50/60"
                    >
                      <ExitIcon />
                      Sair
                    </button>
                  </div>

                  {accountSwitcherOpen && (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600">
                          {profile.initials}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">{profile.name}</p>
                          <p className="text-[11px] text-slate-500">{profile.email}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {switcherAccounts.map((email) => (
                          <button
                            key={email}
                            type="button"
                            onClick={() => handleSwitchAccount(email)}
                            className="flex min-h-[40px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                              {email.charAt(0).toUpperCase()}
                            </span>
                            <span className="flex-1 text-left">
                              <span className="block text-sm font-semibold text-slate-800">{email}</span>
                              <span className="block text-[11px] text-slate-500">Desconectada</span>
                            </span>
                          </button>
                        ))}
                        {showAddGoogleAccount && (
                          <button
                            type="button"
                            onClick={handleAddGoogleAccount}
                            className="flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <GoogleIcon className="h-4 w-4" />
                            Adicionar outra conta Google
                          </button>
                        )}
                        {showAddFacebookAccount && (
                          <button
                            type="button"
                            onClick={handleAddFacebookAccount}
                            className="flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <FacebookIcon className="h-4 w-4" />
                            Adicionar outra conta Facebook
                          </button>
                        )}
                      </div>
                    </div>
                  )}

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
              <div className="mx-auto w-full max-w-md text-center lg:text-left lg:ml-6">
                <p className="text-xs uppercase tracking-[0.3em] text-[#0b4f5c]">Acesso Knexspace One</p>
                <h1 className="text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-tight text-slate-900">
                  Vamos começar
                </h1>
                <p className="mt-2 text-[clamp(1rem,1.2vw,1.1rem)] text-slate-700">
                  Centralize seus produtos, permissões e equipes em uma única conta. Escolha como você quer entrar no
                  KnexIT Workspace.
                </p>
              </div>
              <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-[#f3f6fb] p-4 text-center lg:text-left shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)] lg:mx-0 lg:ml-6">
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
                  <div className="text-center w-full">
                    <h2 className="text-lg font-semibold text-slate-900">Entrar ou criar conta</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Digite seu e-mail. O Knexspace mostra as opções corretas para continuar.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Acesso
                </span>
              </div>

              {!isStepTwo ? (
                <>
                  <form onSubmit={handleLookup} className="mt-5 space-y-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      <span className="sr-only">E-mail</span>
                      <div className="relative mt-2">
                        <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-xs font-semibold text-slate-500">
                          <MailIcon className="h-4 w-4 text-slate-400" />
                          E-mail
                        </span>
                        <input
                          type="email"
                          value={loginEmail}
                          onChange={(event) => setLoginEmail(event.target.value)}
                          autoComplete="email"
                          inputMode="email"
                          className="w-full rounded-2xl border border-slate-300 bg-white pl-[96px] pr-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                          required
                        />
                      </div>
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
                        onClick={() => handleOAuth("facebook")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166fe5]"
                      >
                        <FacebookIcon className="h-6 w-6" />
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
                  <div className={`grid gap-2 ${methodGridClass}`}>
                    {showPasswordMethod && (
                      <button
                        type="button"
                        onClick={() => setSelectedMethod("password")}
                        className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 text-xs font-semibold transition ${
                          selectedMethod === "password"
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {emailExists ? "Entrar com senha" : "Criar senha"}
                      </button>
                    )}
                    {showOtpMethod && (
                      <button
                        type="button"
                        onClick={() => setSelectedMethod("otp")}
                        className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 text-xs font-semibold transition ${
                          selectedMethod === "otp"
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {authIntent === "recovery" ? "Código de recuperação" : "Código por e-mail"}
                      </button>
                    )}
                  </div>

                  {(showGoogleMethod || showFacebookMethod) && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-slate-200" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Ou entre com
                        </p>
                        <span className="h-px flex-1 bg-slate-200" />
                      </div>
                      <div className="mt-3 grid gap-2">
                        {showGoogleMethod && (
                          <button
                            type="button"
                            onClick={() => handleOAuth("google")}
                            className="inline-flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <GoogleIcon className="h-5 w-5" />
                            Entrar com Google
                          </button>
                        )}
                        {showFacebookMethod && (
                          <button
                            type="button"
                            onClick={() => handleOAuth("facebook")}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166fe5]"
                          >
                            <FacebookIcon className="h-6 w-6" />
                            Entrar com Facebook
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedMethod === "password" && authIntent != "recovery" && (
                    <div className="rounded-2xl bg-[#f1f6fb] p-4">
                      <p className="sr-only">
                        {emailExists ? "Entrar com senha" : "Criar conta com senha"}
                      </p>
                      <form onSubmit={handlePasswordAuth} className="mt-3 space-y-3">
                        <label className="block text-sm text-slate-700">
                          <span className="sr-only">Senha</span>
                          <div className="relative mt-2">
                            <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center">
                              <LockIcon className="h-4 w-4 text-slate-400" />
                            </span>
                            <input
                              key={showPassword ? "password-text" : "password-hidden"}
                              id="knexit-password"
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(event) => setPassword(event.target.value)}
                              placeholder="Digite sua senha"
                              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                              autoComplete={emailExists ? "current-password" : "new-password"}
                              required
                            />
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={handlePasswordToggle}
                              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 hover:text-slate-700 pointer-events-auto"
                              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                              aria-pressed={showPassword}
                              aria-controls="knexit-password"
                            >
                              {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                            </button>
                          </div>
                        </label>
                        {!emailExists && (
                          <label className="block text-sm text-slate-700">
                            <span className="sr-only">Confirmar senha</span>
                            <div className="relative mt-2">
                              <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center">
                                <LockIcon className="h-4 w-4 text-slate-400" />
                              </span>
                              <input
                                key={showPasswordConfirm ? "password-confirm-text" : "password-confirm-hidden"}
                                id="knexit-password-confirm"
                                type={showPasswordConfirm ? "text" : "password"}
                                value={passwordConfirm}
                                onChange={(event) => setPasswordConfirm(event.target.value)}
                                placeholder="Confirmar senha"
                                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                                autoComplete="new-password"
                                required
                              />
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={handlePasswordConfirmToggle}
                                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 hover:text-slate-700 pointer-events-auto"
                                aria-label={showPasswordConfirm ? "Ocultar senha" : "Mostrar senha"}
                                aria-pressed={showPasswordConfirm}
                                aria-controls="knexit-password-confirm"
                              >
                                {showPasswordConfirm ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                              </button>
                            </div>
                          </label>
                        )}
                        {!emailExists && (
                          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <label className="flex items-start gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={termsAccepted}
                                onChange={(event) => setTermsAccepted(event.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                              />
                              <span>Concordo com os Termos de Serviço e Política de Privacidade.</span>
                            </label>
                            {useHcaptcha ? (
                              <>
                                <Script src="https://js.hcaptcha.com/1/api.js" strategy="afterInteractive" />
                                <div className="flex justify-center">
                                  <div
                                    className="h-captcha"
                                    data-sitekey={captchaSiteKey}
                                    data-callback="kxCaptchaSuccess"
                                    data-expired-callback="kxCaptchaExpired"
                                    data-error-callback="kxCaptchaError"
                                  />
                                </div>
                              </>
                            ) : null}
                            {useHcaptcha && captchaError && <p className="text-xs text-rose-600">{captchaError}</p>}
                          </div>
                        )}
                        <button
                          type="submit"
                          disabled={passwordLoading || !canSubmitPassword}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--kx-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:brightness-110 disabled:opacity-60"
                        >
                          {passwordLoading
                            ? "Processando..."
                            : emailExists
                              ? "Fazer login"
                              : "Criar conta"}
                        </button>
                      </form>
                    </div>
                  )}

                  {selectedMethod === "otp" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {otpPurpose === "recovery"
                            ? "Confirmar código de recuperação"
                            : otpPurpose === "oauth_verify"
                              ? "Verificar acesso por e-mail"
                              : "Receber código de 6 dígitos"}
                        </p>
                        <span className="text-[11px] font-semibold text-blue-700">OTP</span>
                      </div>
                      <div className="mt-3 space-y-3">
                        {otpSent ? (
                          <>
                            <div className="space-y-2" onPaste={handleOtpPaste}>
                              <p className="text-sm text-slate-700">Código</p>
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

function SwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M7 4l-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M4 7h11a3 3 0 0 1 3 3v1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M17 20l3-3-3-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M20 17H9a3 3 0 0 1-3-3v-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m4 8 8 5 8-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 4l16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3 12s4-6 9-6c1.5 0 2.8.3 4 .8M21 12s-4 6-9 6c-1.6 0-3.1-.4-4.4-1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9.5 9.5a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
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
