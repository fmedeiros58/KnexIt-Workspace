"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminNameStepPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleAdvance = () => {
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
              <h1 className="text-3xl font-semibold text-slate-900">Qual é seu nome?</h1>
              <p className="text-sm text-slate-600">Digite o nome usado na sua conta do KnexIT.</p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nome
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Nome"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sobrenome (opcional)
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Sobrenome"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>

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
