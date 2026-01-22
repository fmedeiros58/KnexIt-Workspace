"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LoginPayload = { email: string } | { phone: string };

function isValidLoginId(value: string) {
  if (!value) return false;
  if (value.includes("@")) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function buildLoginPayload(value: string): LoginPayload {
  if (value.includes("@")) {
    return { email: value };
  }
  return { phone: value.replace(/\D/g, "") };
}

function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "AC";
  if (trimmed.includes("@")) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 2) return digits.slice(0, 2);
  return trimmed.slice(0, 2).toUpperCase();
}

export default function AdminPasswordPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hint = localStorage.getItem("loginEmailHint");
    if (hint) setLoginId(hint.trim());
  }, []);

  const loginLabel = useMemo(() => {
    const trimmed = loginId.trim();
    if (!trimmed) return "Conta do Admin Console";
    return trimmed;
  }, [loginId]);

  const initials = useMemo(() => getInitials(loginLabel), [loginLabel]);

  const handleAdvance = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = loginId.trim();
    if (!isValidLoginId(trimmed)) {
      setError("Informe um e-mail válido ou um telefone com DDD.");
      return;
    }
    if (!password) {
      setError("Digite sua senha para continuar.");
      return;
    }
    setError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      ...buildLoginPayload(trimmed),
      password,
    });
    setLoading(false);
    if (error) {
      setError("E-mail/telefone ou senha inválidos.");
      return;
    }
    if (data?.session) {
      router.push("/admin");
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-100 font-[family:Arial,Helvetica,sans-serif]">
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-10 text-[12px] shadow-sm md:p-12">
          <div className="grid gap-8 md:grid-cols-[1.1fr,1fr] md:items-start">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 text-lg font-semibold text-blue-600">
                KX
              </div>
              <h1 className="text-3xl font-semibold text-slate-900">Confirme sua identidade</h1>
              <p className="text-sm text-slate-600">
                Para continuar, digite a senha da conta de administrador do KnexIT.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {initials}
                </div>
                <span className="max-w-[220px] truncate">{loginLabel}</span>
              </div>
            </div>

            <form onSubmit={handleAdvance} className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Senha
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  aria-invalid={Boolean(error)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Mostrar senha
              </label>

              {error && <p className="text-xs text-rose-600">{error}</p>}

              <Link href="/admin/login/recuperar" className="text-sm font-semibold text-blue-600 no-underline">
                Esqueceu a senha?
              </Link>

              <div className="flex items-center justify-between pt-2 text-sm font-semibold">
                <Link href="/admin/login/outra" className="text-blue-600 no-underline">
                  Usar outra conta
                </Link>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="rounded-full bg-blue-600 px-6 py-2 text-white shadow-sm hover:bg-blue-500 disabled:opacity-60"
                >
                  {loading ? "Entrando..." : "Avançar"}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              Português (Brasil)
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
              Ajuda
            </div>
            <div className="flex items-center gap-3">
              <span>Privacidade</span>
              <span>Termos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
