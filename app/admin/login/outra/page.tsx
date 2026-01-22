"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminOtherAccountPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [error, setError] = useState("");

  const validateLoginId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.includes("@")) {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed);
    }
    const digits = trimmed.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  };

  const handleAdvance = () => {
    if (!validateLoginId(loginId)) {
      setError("Informe um e-mail válido ou um telefone com DDD.");
      return;
    }
    if (typeof window !== "undefined" && loginId) {
      localStorage.setItem("loginEmailHint", loginId.trim());
    }
    setError("");
    router.push("/admin/login/senha");
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
              <h1 className="text-3xl font-semibold text-slate-900">Faça login</h1>
              <p className="text-sm text-slate-600">
                Use sua conta KnexIT para acessar o Admin Console. Esta conta ficará disponível para outros apps no
                navegador.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                E-mail ou telefone
                <input
                  type="text"
                  value={loginId}
                  onChange={(event) => {
                    setLoginId(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="email@exemplo.com"
                  aria-invalid={Boolean(error)}
                  className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 ${
                    error ? "border-rose-400" : "border-slate-300"
                  }`}
                />
              </label>
              {error && <p className="text-xs text-rose-600">{error}</p>}

              <Link href="/admin/login/recuperar" className="text-sm font-semibold text-blue-600 no-underline">
                Esqueceu o e-mail?
              </Link>

              <p className="text-xs text-slate-600">
                Não está no seu computador? Use o modo visitante para fazer login com privacidade. {" "}
                <span className="text-blue-600">Saiba como usar o modo visitante.</span>
              </p>

              <div className="flex items-center justify-end gap-4 pt-2 text-sm font-semibold">
                <Link href="/knexit-workspace/acesso/novo" className="text-blue-600 no-underline">
                  Criar conta
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
