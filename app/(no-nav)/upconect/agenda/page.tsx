// app/(no-nav)/upconect/agenda/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Agenda – UpConect",
  description: "Agendamentos e convites do UpConect (em breve).",
};

export default function UpConectAgendaPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header simples da página (sem navbar global) */}
      <header className="mx-auto max-w-5xl px-6 py-6 flex items-center gap-4">
        <LogoUpConect className="h-10 w-10" />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Agenda do UpConect
          </h1>
          <p className="text-slate-500 -mt-0.5">
            Em breve: agendamento, salas persistentes e convites.
          </p>
        </div>

        <div className="ml-auto">
          <Link
            href="/upconect"
            className="rounded-xl bg-slate-900 text-white px-4 py-2.5 font-semibold hover:bg-slate-800 no-underline"
          >
            ← Voltar
          </Link>
        </div>
      </header>

      {/* Corpo (placeholder) */}
      <main className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-3xl ring-1 ring-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-slate-600">
            Aqui aparecerá sua agenda de reuniões, integração com convites e
            links.
          </p>

          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <PlaceholderCard title="Criar reunião" />
            <PlaceholderCard title="Convites" />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ====== Auxiliares ====== */
function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="rounded-2xl ring-1 ring-slate-200 p-6 text-left">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">Recurso em desenvolvimento.</p>
    </div>
  );
}

function LogoUpConect({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="upcx" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="20" height="16" rx="5" fill="url(#upcx)" />
      <path d="M17 9l3-2v10l-3-2z" fill="#fff" opacity=".95" />
      <circle cx="10.5" cy="12" r="3.8" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="10.5" cy="12" r="1.2" fill="#fff" />
    </svg>
  );
}
