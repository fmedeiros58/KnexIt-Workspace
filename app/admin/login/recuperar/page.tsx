"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminRecoverEmailPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");

  const validateIdentifier = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.includes("@")) {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed);
    }
    const digits = trimmed.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  };

  const handleAdvance = () => {
    if (!validateIdentifier(identifier)) {
      setError("Informe um e-mail válido ou um telefone com DDD.");
      return;
    }
    if (typeof window !== "undefined" && identifier) {
      localStorage.setItem("loginEmailHint", identifier.trim());
    }
    setError("");
    router.push("/admin/login/nome");
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
              <h1 className="text-3xl font-semibold text-slate-900">Encontre seu e-mail</h1>
              <p className="text-sm text-slate-600">
                Digite seu número de telefone ou e-mail de recuperação para localizar a conta do KnexIT Admin.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Número de telefone ou e-mail
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="telefone ou email"
                  aria-invalid={Boolean(error)}
                  className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 ${
                    error ? "border-rose-400" : "border-slate-300"
                  }`}
                />
              </label>
              {error && <p className="text-xs text-rose-600">{error}</p>}

              <div className="flex items-center justify-between pt-2 text-sm font-semibold">
                <Link href="/admin/login/outra" className="text-blue-600 no-underline">
                  Usar outra conta
                </Link>
                <button
                  type="button"
                  onClick={handleAdvance}
                  className="rounded-full bg-blue-600 px-6 py-2 text-white shadow-sm hover:bg-blue-500"
                >
                  Avançar
                </button>
              </div>
            </div>
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

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" aria-hidden="true">
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
