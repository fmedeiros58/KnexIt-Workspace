import Link from "next/link";
import type { ReactNode } from "react";

type HeroIcon = "play" | "live" | "folder" | "doc" | "brain" | "mail";

const HERO_APPS: { name: string; icon: HeroIcon }[] = [
  { name: "VioClass", icon: "play" },
  { name: "VioLive", icon: "live" },
  { name: "SupaDrive", icon: "folder" },
  { name: "VioRead", icon: "doc" },
  { name: "KnexAI", icon: "brain" },
  { name: "KnexMail", icon: "mail" },
];

const ICONS: Record<HeroIcon, { bg?: string; fg?: string; node: ReactNode }> = {
  play: {
    bg: "bg-indigo-50",
    fg: "text-indigo-700",
    node: <path fill="currentColor" d="M9 7.5v9l7-4.5-7-4.5Z" />,
  },
  live: {
    fg: "text-rose-700",
    node: (
      <>
        <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="5.6" fill="white" />
        <rect
          x="4.6"
          y="10.1"
          width="11.8"
          height="8.2"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle
          cx="7.2"
          cy="6.1"
          r="1.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle
          cx="13.1"
          cy="5.5"
          r="2.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M19.8 12.2 16.4 13v1.6l3.4.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  folder: {
    fg: "text-amber-700",
    node: <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" />,
  },
  doc: {
    fg: "text-sky-700",
    node: (
      <>
        <path
          fill="currentColor"
          d="M6.5 4h7l3.5 3.5V18a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v3.5H17L13.5 4Z"
        />
        <rect
          x="8"
          y="9"
          width="6.5"
          height="1.2"
          rx="0.6"
          fill="white"
          fillOpacity={0.85}
        />
        <rect
          x="8"
          y="11"
          width="5.2"
          height="1.2"
          rx="0.6"
          fill="white"
          fillOpacity={0.75}
        />
        <rect
          x="8"
          y="13"
          width="4.2"
          height="1.2"
          rx="0.6"
          fill="white"
          fillOpacity={0.65}
        />
        <circle cx="15.5" cy="15.5" r="1.4" fill="white" fillOpacity={0.9} />
        <circle cx="17.6" cy="14.9" r="1.4" fill="white" fillOpacity={0.75} />
      </>
    ),
  },
  brain: {
    fg: "text-fuchsia-700",
    node: (
      <path
        fill="currentColor"
        d="M9.5 4A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H11V4H9.5Zm5 0H13v16h1.5A2.5 2.5 0 0 0 17 17.5v-11A2.5 2.5 0 0 0 14.5 4Z"
      />
    ),
  },
  mail: {
    fg: "text-blue-700",
    node: (
      <path
        fill="currentColor"
        d="M5 6h14a1 1 0 0 1 1 1v10H4V7a1 1 0 0 1 1-1Zm13 2.24-6 3.51-6-3.5V8l6 3.5 6-3.5v.24Z"
      />
    ),
  },
};

function AppIcon({ icon }: { icon: HeroIcon }) {
  const cfg = ICONS[icon];
  if (!cfg) return null;

  const wrapperClass = `inline-flex h-12 w-12 items-center justify-center rounded-xl ${cfg.bg ?? ""}`;
  const svgClass = `h-10 w-10 ${cfg.fg ?? ""}`;

  return (
    <div className={wrapperClass}>
      <svg viewBox="0 0 24 24" className={svgClass} aria-hidden>
        {cfg.node}
      </svg>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="space-y-4 md:w-1/2">
          <div className="flex flex-wrap items-center gap-3">
            {HERO_APPS.map((app) => (
              <div
                key={app.name}
                className="inline-flex h-14 w-14 items-center justify-center"
              >
                <AppIcon icon={app.icon} />
              </div>
            ))}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight text-black">
            Veja sua instituição ir mais longe com o KnexIT Workspace
          </h1>

          <p className="text-lg text-slate-700">
            Suíte integrada para aulas, lives, arquivos, IA e colaboração.
            Crie, organize e compartilhe tudo em um só lugar com segurança e
            escala.
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
                <p className="text-sm font-semibold text-slate-900">
                  Aulas, lives e arquivos
                </p>
                <p className="text-sm text-slate-600">
                  Publique videoaulas, agende VioLive e guarde materiais no
                  SupaDrive.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  IA em todo o fluxo
                </p>
                <p className="text-sm text-slate-600">
                  Traduza com VioRead, revise com KnexReview e dispare
                  lembretes no KnexMail.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  Colaboração simples
                </p>
                <p className="text-sm text-slate-600">
                  Docs, chat e tarefas sincronizados para turmas e equipes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
