"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const theme = {
  "--kx-bg": "#f5f7fb",
  "--kx-ink": "#0b1220",
  "--kx-muted": "#5b6472",
  "--kx-card": "#ffffff",
  "--kx-border": "#e2e8f0",
  "--kx-primary": "#1e5df5",
} as CSSProperties;

const methods = [
  {
    id: "new-domain",
    title: "Receber um novo domínio personalizado",
    description: "Compre um novo domínio e desenvolva sua marca on-line.",
  },
  {
    id: "existing-domain",
    title: "Configurar usando seu domínio atual",
    description: "Use o domínio que você já tem.",
  },
];

export default function KnexitWorkspaceSetupMethodPage() {
  const searchParams = useSearchParams();
  const accountType = searchParams.get("type") ?? "business";
  const teamSize = searchParams.get("team");

  const accountLabel = useMemo(
    () => (accountType === "personal" ? "Conta pessoal" : "Conta empresarial"),
    [accountType],
  );

  const [selected, setSelected] = useState("existing-domain");

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

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-5xl flex-col justify-center px-5 py-12">
          <div className="mb-8 flex w-full items-center justify-between">
            <Link
              href={`/knexit-workspace/acesso/novo/contato?type=${encodeURIComponent(accountType)}${
                teamSize ? `&team=${encodeURIComponent(teamSize)}` : ""
              }`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 no-underline hover:no-underline"
              aria-label="Voltar"
            >
              <BackIcon />
            </Link>
            <div className="text-sm font-semibold text-slate-500">Passo 3 de 3</div>
            <div className="h-11 w-11" aria-hidden />
          </div>

          <div className="mx-auto w-full max-w-3xl text-center">
            <h1 className="text-3xl font-semibold md:text-4xl">
              Escolha uma forma de configurar sua conta
            </h1>
            <p className="mt-3 text-sm text-[var(--kx-muted)]">
              Você vai precisar de um domínio, como example.com, para configurar o e-mail e sua conta.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{accountLabel}</span>
              {accountType === "business" && teamSize ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Equipe: {teamSize}</span>
              ) : null}
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {methods.map((option) => {
              const active = selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelected(option.id)}
                  className={`group w-full rounded-2xl border p-6 text-left shadow-sm transition ${
                    active
                      ? "border-blue-500 bg-white shadow-blue-200/60"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                        active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {option.id === "new-domain" ? <DomainIcon /> : <GlobeIcon />}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{option.title}</h3>
                      <p className="mt-2 text-sm text-[var(--kx-muted)]">{option.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-10 flex justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full bg-[var(--kx-primary)] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:brightness-110"
            >
              Continuar com este método
            </button>
          </div>
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

function DomainIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden="true">
      <rect x="8" y="10" width="28" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="28" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M38 34l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 16h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden="true">
      <circle cx="22" cy="22" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 22h24M22 10c4 4 4 20 0 24M22 10c-4 4-4 20 0 24" stroke="currentColor" strokeWidth="2" />
      <circle cx="38" cy="14" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M38 11v6m-3-3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
