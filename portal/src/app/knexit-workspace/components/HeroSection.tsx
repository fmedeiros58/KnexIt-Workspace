import Link from "next/link";
import type { ReactElement } from "react";

const HERO_APPS = [
  { name: "VioClass", icon: "play" as const },
  { name: "VioLive", icon: "live" as const },
  { name: "SupaDrive", icon: "folder" as const },
  { name: "VioRead", icon: "doc" as const },
  { name: "KnexAI", icon: "brain" as const },
  { name: "KnexMail", icon: "mail" as const },
];

const ICONS: Record<string, { fg?: string; node: ReactElement }> = {
  play: { fg: "text-indigo-700", node: <path fill="currentColor" d="M9 7.5v9l7-4.5-7-4.5Z" /> },
  live: {
    node: (
      <g>
        <rect x="3" y="7" width="11" height="10" rx="2" fill="#1A73E8" />
        <rect x="5" y="6" width="11" height="10" rx="2" fill="#FBBC04" />
        <rect x="6" y="8" width="11" height="10" rx="2" fill="#34A853" />
        <path d="M15.5 9.75 21 12.2l-5.5 2.45v-4.9Z" fill="#0F9D58" />
        <circle cx="11" cy="13" r="2" fill="white" />
      </g>
    ),
  },
  folder: { fg: "text-amber-700", node: <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" /> },
  doc: {
    fg: "text-sky-700",
    node: (
      <path
        fill="currentColor"
        d="M7 4h7l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm6 1.5V9h3.5L13 5.5Zm-5 6h8v1.5H8Zm0 3h5v1.5H8Z"
      />
    ),
  },
  brain: {
    fg: "text-fuchsia-700",
    node: <path fill="currentColor" d="M9.5 4A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H11V4H9.5Zm5 0H13v16h1.5A2.5 2.5 0 0 0 17 17.5v-11A2.5 2.5 0 0 0 14.5 4Z" />,
  },
  mail: {
    fg: "text-blue-700",
    node: <path fill="currentColor" d="M5 6h14a1 1 0 0 1 1 1v10H4V7a1 1 0 0 1 1-1Zm13 2.24-6 3.51-6-3.5V8l6 3.5 6-3.5v.24Z" />,
  },
};

function AppIcon({ icon }: { icon: string }) {
  const cfg = ICONS[icon];
  if (!cfg) return null;
  if (icon === "live") {
    return <svg viewBox="0 0 24 24" className="h-12 w-12" aria-hidden>{cfg.node}</svg>;
  }
  return (
    <svg viewBox="0 0 24 24" className={`h-12 w-12 ${cfg.fg ?? ""}`} aria-hidden>
      {cfg.node}
    </svg>
  );
}

export default function HeroSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="space-y-4 md:w-1/2">
          <div className="flex flex-wrap items-center gap-3">
            {HERO_APPS.map((app) => (
              <div key={app.name} className="inline-flex h-14 w-14 items-center justify-center">
                <AppIcon icon={app.icon} />
              </div>
            ))}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight text-black">
            Veja sua instituição ir mais longe com o KnexIT Workspace
          </h1>
          <p className="text-lg text-slate-700">
            Suíte integrada para aulas, lives, arquivos, IA e colaboração. Crie, organize e compartilhe tudo em um só lugar com
            segurança e escala.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="#contato"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold shadow-sm"
            >
              Falar com o time
            </Link>
            <Link
              href="#planos"
              className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 px-6 py-3 rounded-xl font-semibold"
            >
              Ver planos
            </Link>
          </div>
        </div>

        <div className="md:w-1/2">
          <div className="relative rounded-3xl border border-slate-200 bg-white shadow-lg p-6">
            <div className="absolute left-4 top-4 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Apps conectados
            </div>
            <div className="mt-10 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-indigo-50/60 p-4">
                <p className="text-sm font-semibold text-slate-900">Aulas, lives e arquivos</p>
                <p className="text-sm text-slate-600">Publique videoaulas, agende VioLive e guarde materiais no SupaDrive.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">IA em todo o fluxo</p>
                <p className="text-sm text-slate-600">Traduza com VioRead, revise com KnexReview e dispare lembretes no KnexMail.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Colaboração simples</p>
                <p className="text-sm text-slate-600">Docs, chat e tarefas sincronizados para turmas e equipes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
