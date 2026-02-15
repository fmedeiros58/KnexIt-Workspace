"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const theme = {
  "--kx-bg": "#f5f7fb",
  "--kx-ink": "#0b1220",
  "--kx-muted": "#5b6472",
  "--kx-card": "#ffffff",
  "--kx-border": "#e2e8f0",
  "--kx-primary": "#1e5df5",
  "--kx-secondary": "#0f766e",
  "--kx-accent": "#22c55e",
} as CSSProperties;

const TEAM_SIZES = [
  { value: "solo", label: "Só você" },
  { value: "2-9", label: "2 a 9" },
  { value: "10-99", label: "10 a 99" },
  { value: "100-299", label: "100 a 299" },
  { value: "300+", label: "300 ou mais" },
];

export default function KnexitWorkspaceAccountSetupPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"" | "personal" | "business">("");
  const [teamSize, setTeamSize] = useState("");

  const handleAdvance = () => {
    if (!accountType) return;
    if (accountType === "business" && !teamSize) return;
    const params = new URLSearchParams();
    params.set("type", accountType);
    if (accountType === "business" && teamSize) {
      params.set("team", teamSize);
    }
    router.push(`/knexit-workspace/acesso/novo/contato?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[var(--kx-bg)] text-[var(--kx-ink)] font-[family:Arial,Helvetica,sans-serif]" style={theme}>
      <style>{`
        .fade-in {
          animation: fadeIn 0.7s ease-out both;
        }
        .floaty {
          animation: floaty 6s ease-in-out infinite;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(18px);
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
            transform: translateY(-10px);
          }
        }
      `}</style>

      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute -left-28 top-10 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute right-[-120px] top-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-80px] right-1/3 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />

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

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 px-5 py-12 lg:min-h-[calc(100vh-88px)] lg:grid-cols-[1fr,1fr] lg:items-center lg:py-0">
          <section className="space-y-6 fade-in">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Novo Workspace</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
                Vamos começar
              </h1>
            </div>

            <form className="space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-slate-700">Tipo de conta</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { value: "personal", title: "Conta pessoal", desc: "Uso individual, sem equipe." },
                    { value: "business", title: "Conta empresarial", desc: "Para empresa ou time." },
                  ].map((option) => {
                    const active = accountType === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer flex-col gap-1 rounded-2xl border px-4 py-3 text-sm ${
                          active
                            ? "border-blue-500 bg-blue-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="account-type"
                          value={option.value}
                          checked={active}
                          onChange={() => setAccountType(option.value as "personal" | "business")}
                          className="sr-only"
                        />
                        <span className="text-sm font-semibold">{option.title}</span>
                        <span className="text-xs text-slate-500">{option.desc}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {accountType === "business" && (
                <label className="block text-sm font-semibold text-slate-700">
                  Nome da empresa
                  <input
                    type="text"
                    placeholder="Nome da empresa"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  />
                </label>
              )}

              {accountType === "personal" && (
                <label className="block text-sm font-semibold text-slate-700">
                  Nome completo
                  <input
                    type="text"
                    placeholder="Seu nome"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  />
                </label>
              )}

              {accountType === "business" && (
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold text-slate-700">
                    Número de funcionários, incluindo você
                  </legend>
                  <div className="space-y-2">
                    {TEAM_SIZES.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:border-slate-300"
                      >
                        <input
                          type="radio"
                          name="team-size"
                          value={option.value}
                          checked={teamSize === option.value}
                          onChange={() => setTeamSize(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <label className="block text-sm font-semibold text-slate-700">
                Região
                <select className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200">
                  <option>Brasil</option>
                  <option>Portugal</option>
                  <option>Estados Unidos</option>
                  <option>México</option>
                  <option>Outros</option>
                </select>
              </label>

              <button
                type="button"
                onClick={handleAdvance}
                disabled={!accountType || (accountType === "business" && !teamSize)}
                className="inline-flex items-center justify-center rounded-full bg-[var(--kx-primary)] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Avançar
              </button>
            </form>
          </section>

          <section className="fade-in">
            <div className="relative flex items-center justify-center rounded-[40px] border border-[var(--kx-border)] bg-white/80 p-10 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="absolute -top-6 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-500 to-emerald-400 opacity-80 blur-md" />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-blue-600">
                <SparkIcon />
              </div>

              <div className="space-y-4 text-center">
                <div className="floaty mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-emerald-50">
                  <EnvelopeIcon />
                </div>
                <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Recurso incluso
                </span>
                <h2 className="text-3xl font-semibold">
                  Tenha um endereço de e-mail profissional
                </h2>
                <p className="text-sm text-[var(--kx-muted)]">
                  Reforce a confiança com um domínio exclusivo, onboarding guiado e acesso imediato aos apps do KnexIT
                  Workspace.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14 text-blue-600" aria-hidden="true">
      <rect x="6" y="14" width="52" height="36" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M10 20l22 16 22-16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M10 44l16-12M54 44L38 32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
      <path
        d="M12 2.5 13.6 8l5.5 1.6-5.5 1.6L12 16.7 10.4 11.2 4.9 9.6 10.4 8 12 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
