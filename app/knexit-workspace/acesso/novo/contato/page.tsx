import type { CSSProperties } from "react";
import Link from "next/link";

const theme = {
  "--kx-bg": "#f5f7fb",
  "--kx-ink": "#0b1220",
  "--kx-muted": "#5b6472",
  "--kx-card": "#ffffff",
  "--kx-border": "#e2e8f0",
  "--kx-primary": "#1e5df5",
} as CSSProperties;

export default function KnexitWorkspaceContactPage() {
  return (
    <main className="min-h-screen bg-[var(--kx-bg)] text-[var(--kx-ink)] font-[family:Arial,Helvetica,sans-serif]" style={theme}>
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute -left-28 top-12 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute right-[-120px] top-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />

        <header className="relative z-10 border-b border-slate-200/80 bg-white/70 backdrop-blur">
          <div className="mx-auto grid w-full grid-cols-[1fr,auto,1fr] items-center px-4 py-4 sm:px-6">
            <div />
            <Link
              href="/knexit-workspace"
              className="text-[1.75rem] font-semibold tracking-tight no-underline hover:no-underline"
            >
              <span className="text-blue-700">KnexIT</span>
              <span className="text-slate-900"> Workspace</span>
            </Link>
            <div className="flex justify-end">
              <div className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-emerald-400 to-rose-500 p-[2px] shadow-sm">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-700">
                  KX
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-5 py-12 text-center">
          <div className="mb-8 flex w-full items-center justify-between">
            <Link
              href="/knexit-workspace/acesso/novo"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 no-underline hover:no-underline"
              aria-label="Voltar"
            >
              <BackIcon />
            </Link>
            <div className="text-sm font-semibold text-slate-500">Passo 2 de 3</div>
            <div className="h-11 w-11" aria-hidden />
          </div>

          <h1 className="text-4xl font-semibold md:text-5xl">
            Informações de contato
          </h1>
          <p className="mt-3 max-w-xl text-sm text-[var(--kx-muted)]">
            Ao criar sua conta KnexIT Workspace, você será o administrador principal deste novo ambiente.
          </p>

          <form className="mt-10 w-full max-w-md space-y-5 text-left">
            <label className="block text-sm font-semibold text-slate-700">
              Nome
              <input
                type="text"
                placeholder="Nome"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Sobrenome
              <input
                type="text"
                placeholder="Sobrenome"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Endereço de e-mail atual
              <input
                type="email"
                placeholder="email@exemplo.com"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </label>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--kx-primary)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:brightness-110"
            >
              Avançar
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
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
