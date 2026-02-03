"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const theme = {
  "--kx-bg": "#f5f7fb",
  "--kx-ink": "#0b1220",
  "--kx-muted": "#5b6472",
  "--kx-card": "#ffffff",
  "--kx-border": "#e2e8f0",
  "--kx-primary": "#1e5df5",
} as CSSProperties;

export default function KnexitWorkspaceContactPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountType = searchParams.get("type") ?? "business";
  const teamSize = searchParams.get("team");
  const accountLabel = useMemo(
    () => (accountType === "personal" ? "Conta pessoal" : "Conta empresarial"),
    [accountType],
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [expectedCode, setExpectedCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const codeInputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const codeLength = 6;

  const canAdvance = Boolean(expectedCode) && code.trim() === expectedCode;

  const updateCodeAt = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(-1);
    const next = code.padEnd(codeLength, " ").split("");
    next[index] = sanitized || " ";
    const merged = next.join("").replace(/\s+$/g, "");
    setCode(merged);
    if (sanitized && codeInputsRef.current[index + 1]) {
      codeInputsRef.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !code[index] && codeInputsRef.current[index - 1]) {
      codeInputsRef.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, codeLength);
    if (!pasted) return;
    event.preventDefault();
    const next = pasted.padEnd(codeLength, " ").split("").join("").replace(/\s+$/g, "");
    setCode(next);
    const lastIndex = Math.min(pasted.length, codeLength) - 1;
    if (codeInputsRef.current[lastIndex]) {
      codeInputsRef.current[lastIndex]?.focus();
    }
  };

  const handleAdvance = () => {
    if (!canAdvance) return;
    const params = new URLSearchParams();
    params.set("type", accountType);
    if (teamSize) params.set("team", teamSize);
    if (email.trim()) params.set("email", email.trim());
    router.push(`/knexit-workspace/acesso/novo/configurar?${params.toString()}`);
  };

  const handleSendCode = async () => {
    if (isSending) return;
    if (!email.trim()) {
      setError("Informe um e-mail válido para enviar o código.");
      return;
    }
    setError(null);
    setNotice(null);
    setIsSending(true);
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedCode(generated);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.trim(),
          subject: "Código de confirmação",
          text: `Seu código de confirmação: ${generated}`,
          html: `<p>Seu código de confirmação: <b>${generated}</b></p>`,
        }),
      });
      if (!res.ok) {
        throw new Error("send_failed");
      }
      setNotice("Código enviado para o e-mail informado.");
    } catch {
      setError("Não foi possível enviar o código. Verifique o e-mail e tente novamente.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main
      className="kx-scroll min-h-screen overflow-y-auto bg-[var(--kx-bg)] text-[var(--kx-ink)] font-[family:Arial,Helvetica,sans-serif] scroll-smooth"
      style={{ ...theme, scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`
        .kx-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>
      <div className="relative min-h-full">
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

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{accountLabel}</span>
            {accountType === "business" && teamSize ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Equipe: {teamSize}</span>
            ) : null}
          </div>


          <form className="mt-10 w-full max-w-md space-y-5 pb-10 text-left">
            <label className="block text-sm font-semibold text-slate-700">
              Nome
              <input
                type="text"
                placeholder="Nome"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Sobrenome
              <input
                type="text"
                placeholder="Sobrenome"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Endereço de e-mail atual
              <input
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              />
            </label>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Confirmação de e-mail</p>
                  <p className="text-xs text-slate-500">Vamos enviar um código de 6 dígitos para confirmar.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isSending || !email.trim()}
                  className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? "Enviando..." : expectedCode ? "Reenviar código" : "Enviar código"}
                </button>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Código de confirmação
                <div
                  className="mt-3 flex justify-center gap-2"
                  onPaste={handleCodePaste}
                >
                  {Array.from({ length: codeLength }).map((_, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        codeInputsRef.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={code[index] ?? ""}
                      onChange={(event) => updateCodeAt(index, event.target.value)}
                      onKeyDown={(event) => handleCodeKeyDown(index, event)}
                      className="h-12 w-12 rounded-xl border border-slate-300 bg-white text-center text-lg font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                    />
                  ))}
                </div>
              </label>

              {notice ? <p className="text-xs text-emerald-600">{notice}</p> : null}
              {error ? <p className="text-xs text-rose-600">{error}</p> : null}
            </div>

            <button
              type="button"
              disabled={!canAdvance}
              onClick={handleAdvance}
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--kx-primary)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
