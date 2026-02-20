"use client";

import { useEffect } from "react";

export default function KnexchatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[KnexChat] segment error", error);
    }
  }, [error]);

  return (
    <main className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-[var(--kx-bg)] px-6 text-slate-700">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-base font-semibold text-slate-900">Falha ao abrir o KnexChat</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ocorreu um erro inesperado ao carregar a tela. Você pode tentar novamente.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
