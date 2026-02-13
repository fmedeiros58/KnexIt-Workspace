"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthScaffold from "../_components/AuthScaffold";
import { buildAccessStepHref, isEmail, normalizeEmail } from "../_lib/authFlow";

export default function EmailStepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const normalized = normalizeEmail(email);
    if (!isEmail(normalized)) {
      setError("Informe um e-mail valido.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/lookup-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalized }),
    });
    setLoading(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "Falha ao validar o e-mail.");
      return;
    }

    const payload = (await res.json().catch(() => ({}))) as {
      exists?: boolean;
      hasPassword?: boolean;
      methods?: { otp?: boolean };
    };
    const exists = Boolean(payload.exists);
    const twoStep = exists ? Boolean(payload.methods?.otp) : true;

    router.push(
      buildAccessStepHref("senha", searchParams, {
        email: normalized,
        exists: exists ? "1" : "0",
        hasPassword: payload.hasPassword ? "1" : "0",
        twoStep: twoStep ? "1" : "0",
      }),
    );
  };

  return (
    <AuthScaffold>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="w-full text-center">
          <h2 className="text-lg font-semibold text-slate-900">Entrar ou criar conta</h2>
          <p className="mt-2 text-sm text-slate-600">Digite seu e-mail. O Knexspace mostra as opcoes corretas para continuar.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Acesso</span>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={handleLookup} className="space-y-4">
        <label className="block text-sm font-semibold text-slate-700">
          <span className="sr-only">E-mail</span>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
              E-mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-20 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              required
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={loading || !email}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#0f5bd6] px-4 py-3 text-center text-sm font-semibold leading-snug text-white shadow-lg shadow-blue-500/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Verificando..." : "Continuar"}
        </button>
      </form>
    </AuthScaffold>
  );
}
