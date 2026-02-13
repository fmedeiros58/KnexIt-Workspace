import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type AuthScaffoldProps = {
  children: ReactNode;
};

const theme = {
  "--kx-bg": "#E6F2F4",
  "--kx-ink": "#0b1220",
  "--kx-muted": "#51616E",
  "--kx-card": "#ffffff",
  "--kx-border": "#D5E6EA",
} as CSSProperties;

export default function AuthScaffold({ children }: AuthScaffoldProps) {
  return (
    <main
      className="min-h-[100dvh] bg-[var(--kx-bg)] text-[var(--kx-ink)] font-[family:Arial,Helvetica,sans-serif]"
      style={theme}
    >
      <style>{`
        .fade-up {
          animation: fadeUp 0.45s ease-out both;
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <header
        className="fixed inset-x-0 top-0 z-40 border-b border-white/20 backdrop-blur"
        style={{ backgroundColor: "rgba(62, 143, 163, 0.85)" }}
      >
        <div className="mx-auto grid w-full grid-cols-[1fr,auto,1fr] items-center px-4 py-4 sm:px-6 lg:px-8">
          <div />
          <Link
            href="/knexit-workspace"
            className="text-[clamp(1.4rem,2.6vw,1.85rem)] font-semibold tracking-tight text-white no-underline hover:no-underline"
          >
            Knexspace One
          </Link>
          <div />
        </div>
      </header>

      <div className="relative z-10 flex min-h-[100dvh] items-center pt-20 sm:pt-24">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-6 md:py-10 lg:px-8">
          <div className="rounded-3xl border border-[var(--kx-border)] bg-white p-5 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.4)] sm:p-6 lg:p-7">
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr),minmax(0,420px)]">
              <section className="fade-up flex flex-col items-center justify-center space-y-4 text-center lg:border-r lg:border-slate-300/80 lg:pr-8">
                <div className="mx-auto w-full max-w-md text-center">
                  <p className="self-start text-left text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-tight text-[#0f5bd6] drop-shadow-[0_0_10px_rgba(15,91,214,0.35)] lg:relative lg:-left-6 lg:-top-3">
                    Faca login
                  </p>
                  <h1 className="mt-2 text-[clamp(1.05rem,1.7vw,1.35rem)] font-semibold leading-tight text-slate-900">
                    Novo por aqui?
                  </h1>
                  <p className="mt-2 text-[clamp(1rem,1.2vw,1.1rem)] text-slate-700">
                    Centralize seus produtos, permissoes e equipes em uma unica conta. Escolha como voce quer entrar no
                    Knexspace One.
                  </p>
                </div>
                <div className="mx-auto w-full max-w-md text-center">
                  <p className="text-sm text-slate-700">
                    Comece do zero com uma nova conta para um e-mail personalizado, como voce@knexmail.com
                  </p>
                  <Link
                    href="/knexit-workspace/acesso/novo"
                    className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-full bg-[#0f5bd6] px-5 py-2 text-xs font-semibold text-white no-underline hover:brightness-110 hover:no-underline sm:text-sm"
                  >
                    Crie uma conta Knex
                  </Link>
                </div>
              </section>

              <section className="fade-up flex flex-col justify-center space-y-4 lg:pl-8">{children}</section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
