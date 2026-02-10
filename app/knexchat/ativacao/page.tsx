"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function KnexchatActivationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get("returnTo") || "/knexchat/web";

  return (
    <main className="min-h-screen bg-[#f2f6fb] text-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_60px_-35px_rgba(15,23,42,0.45)]">
        <div className="mb-4 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          KnexChat
        </div>
        <h1 className="text-2xl font-semibold">Ative seu acesso ao KnexChat</h1>
        <p className="mt-3 text-sm text-slate-600">
          Sua conta Knex ID está ativa, mas o KnexChat ainda não foi habilitado para este usuário ou time.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/login?from=${encodeURIComponent(returnTo)}`}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 no-underline"
          >
            Entrar com outra conta
          </Link>
          <Link
            href="/knexit-workspace/precos"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 no-underline"
          >
            Ver planos
          </Link>
        </div>
        <button
          type="button"
          onClick={() => router.replace(returnTo)}
          className="mt-4 text-xs font-semibold text-blue-600 hover:underline"
        >
          Voltar para o app
        </button>
      </div>
    </main>
  );
}
