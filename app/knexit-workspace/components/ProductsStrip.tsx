import Link from "next/link";

export type WorkspaceProduct = {
  id: string;
  name: string;
  slug: string;
  category: "video" | "produtividade" | "ia" | "comunicacao" | "infra";
  description: string;
  icon?: "play" | "record" | "edit" | "live" | "folder" | "supadrive" | "doc" | "read" | "kanban" | "chat" | "search" | "review" | "analytics" | "brain" | "owl" | "mail" | "credit" | "hub";
};

const PRODUCTS: WorkspaceProduct[] = [
  { id: "vioclass", name: "VioClass", slug: "vioclass", category: "video", description: "Plataforma de cursos e aulas em vídeo.", icon: "play" },
  { id: "violive", name: "VioLive", slug: "violive", category: "video", description: "Aulas ao vivo e mentorias síncronas.", icon: "live" },
  { id: "viorecord", name: "VioRecord", slug: "viorecord", category: "video", description: "Grave tela, webcam e voz no navegador.", icon: "record" },
  { id: "viostudio", name: "VioStudio", slug: "viostudio", category: "video", description: "Edição online de vídeo e legendas.", icon: "edit" },
  { id: "vioanalytics", name: "VioAnalytics", slug: "vioanalytics", category: "video", description: "Métricas de visualização e engajamento.", icon: "analytics" },
  { id: "viohub", name: "VioHub", slug: "viohub", category: "video", description: "Produção audiovisual integrada e entrega.", icon: "hub" },
  { id: "supadrive", name: "SupaDrive", slug: "supadrive", category: "produtividade", description: "Drive de arquivos para materiais e provas.", icon: "supadrive" },
  { id: "knexdocs", name: "KnexDocs", slug: "knexdocs", category: "produtividade", description: "Documentos colaborativos em tempo real.", icon: "doc" },
  { id: "knexflow", name: "KnexFlow", slug: "knexflow", category: "produtividade", description: "Tarefas, quadros e fluxos de trabalho.", icon: "kanban" },
  { id: "knexchat", name: "KnexChat", slug: "knexchat", category: "comunicacao", description: "Chat interno para times e turmas.", icon: "chat" },
  { id: "knexsearch", name: "KnexSearch", slug: "knexsearch", category: "ia", description: "Busca global com IA em aulas e arquivos.", icon: "search" },
  { id: "vioread", name: "VioRead", slug: "vioread", category: "produtividade", description: "Leitura assistida de PDFs e artigos.", icon: "read" },
  { id: "knexreview", name: "KnexReview", slug: "knexreview", category: "produtividade", description: "Revisão sistemática de literatura.", icon: "review" },
  { id: "knexai", name: "KnexAI", slug: "knexai", category: "ia", description: "Camada unificada de IA e assistentes.", icon: "owl" },
  { id: "knexmail", name: "KnexMail", slug: "knexmail", category: "comunicacao", description: "E-mails transacionais e campanhas.", icon: "mail" },
  { id: "knexpay", name: "KnexPay", slug: "knexpay", category: "infra", description: "Billing e planos em breve.", icon: "credit" },
];

const CATEGORY_LABEL: Record<WorkspaceProduct["category"], string> = {
  video: "Vídeo",
  produtividade: "Produtividade",
  ia: "IA",
  comunicacao: "Comunicação",
  infra: "Infraestrutura",
};

type IconConfig = { bg: string; fg: string; type: NonNullable<WorkspaceProduct["icon"]> };
const CARD_COLORS = [
  "#4338CA", "#047857", "#B45309", "#BE123C", "#0369A1",
  "#7C3AED", "#2563EB", "#15803D", "#C2410C", "#0EA5E9",
  "#9333EA", "#1D4ED8", "#065F46", "#B91C1C", "#0F766E",
];

const ICONS: Record<NonNullable<WorkspaceProduct["icon"]>, { bg: string; fg: string; path: JSX.Element }> = {
  play: {
    bg: "bg-indigo-100",
    fg: "text-indigo-700",
    path: (
      <>
        <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2" fill="white" />
        <rect x="5.2" y="5.8" width="13.6" height="8.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="9.9" r="1.7" fill="currentColor" />
        <rect x="10.4" y="11.7" width="3.2" height="2.8" rx="0.8" fill="currentColor" />
        <rect x="5.2" y="16.1" width="13.6" height="1.7" rx="0.7" fill="currentColor" />
        <rect x="6.1" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
        <rect x="9.3" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
        <rect x="12.5" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
        <rect x="15.7" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
      </>
    ),
  },
  analytics: {
    bg: "bg-cyan-100",
    fg: "text-cyan-700",
    path: (
      <>
        <path fill="currentColor" d="M6.5 5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11A1.5 1.5 0 0 1 6.5 5Z" />
        <rect x="7.5" y="12.8" width="1.8" height="4.2" rx="0.6" fill="white" />
        <rect x="10.1" y="11.2" width="1.8" height="5.8" rx="0.6" fill="white" fillOpacity="0.85" />
        <rect x="12.7" y="9.7" width="1.8" height="7.3" rx="0.6" fill="white" fillOpacity="0.7" />
        <rect x="15.3" y="8.5" width="1.8" height="8.5" rx="0.6" fill="white" fillOpacity="0.55" />
      </>
    ),
  },
  live: {
    bg: "bg-rose-100",
    fg: "text-rose-700",
    path: (
      <>
        <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="5.6" fill="white" />
        <rect x="4.6" y="10.1" width="11.8" height="8.2" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="7.2" cy="6.1" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="13.1" cy="5.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19.8 12.2 16.4 13.0v1.6l3.4 0.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  record: {
    bg: "bg-red-100",
    fg: "text-red-700",
    path: (
      <>
        <rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.4" fill="currentColor" />
      </>
    ),
  },
  edit: {
    bg: "bg-red-100",
    fg: "text-red-700",
    path: (
      <g fill="currentColor">
        <path d="M5 5h9v2H5v10h10v-5h2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        <path d="M19.7 5.3 17.2 2.8a1 1 0 0 0-1.4 0L13 5.6V9h3.4l2.9-2.9a1 1 0 0 0 0-1.4Z" />
      </g>
    ),
  },
  folder: {
    bg: "bg-amber-100",
    fg: "text-amber-700",
    path: <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" />,
  },
  supadrive: {
    bg: "bg-blue-100",
    fg: "text-blue-700",
    path: (
      <>
        <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" />
        <path
          d="M8.5 13.5c0-.9.7-1.6 1.6-1.6.6 0 1.1.3 1.8 1l.2.2.2-.2c.7-.7 1.2-1 1.8-1 1 0 1.7.7 1.7 1.6s-.7 1.6-1.7 1.6c-.6 0-1.1-.3-1.8-1l-.2-.2-.2.2c-.7.7-1.2 1-1.8 1-.9 0-1.6-.7-1.6-1.6Z"
          fill="none"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  doc: {
    bg: "bg-sky-100",
    fg: "text-sky-700",
    path: (
      <>
        <path
          fill="currentColor"
          d="M6.5 4h7l3.5 3.5V18a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v3.5H17L13.5 4Z"
        />
        <rect x="8" y="9" width="6.5" height="1.2" rx="0.6" fill="white" fillOpacity="0.85" />
        <rect x="8" y="11" width="5.2" height="1.2" rx="0.6" fill="white" fillOpacity="0.75" />
        <rect x="8" y="13" width="4.2" height="1.2" rx="0.6" fill="white" fillOpacity="0.65" />
        <circle cx="15.5" cy="15.5" r="1.4" fill="white" fillOpacity="0.9" />
        <circle cx="17.6" cy="14.9" r="1.4" fill="white" fillOpacity="0.75" />
      </>
    ),
  },
  kanban: {
    bg: "bg-emerald-100",
    fg: "text-emerald-700",
    path: <path fill="currentColor" d="M5 5h14v14H5V5Zm2 2.5v9h2v-9H7Zm4 0v4h2v-4h-2Zm4 0v6.5h2v-6.5h-2Z" />,
  },
  chat: {
    bg: "bg-teal-100",
    fg: "text-teal-700",
    path: <path fill="currentColor" d="M5 5h14v9H9l-4 4V5Zm2.5 3.5v1.5h9V8.5h-9Zm0 3v1.5h6V11.5h-6Z" />,
  },
  search: {
    bg: "bg-purple-100",
    fg: "text-purple-700",
    path: <path fill="currentColor" d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm5.5 11.1 3.4 3.4-1.4 1.4-3.4-3.4 1.4-1.4Z" />,
  },
  review: {
    bg: "bg-emerald-100",
    fg: "text-emerald-700",
    path: (
      <>
        <path fill="currentColor" d="M7 4h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v4h4l-4-4Z" />
        <rect x="8.2" y="10" width="6" height="1.1" rx="0.55" fill="white" fillOpacity="0.85" />
        <rect x="8.2" y="12" width="4.5" height="1.1" rx="0.55" fill="white" fillOpacity="0.7" />
        <circle cx="16.8" cy="16.2" r="1.8" fill="white" fillOpacity="0.95" />
        <path d="m16.1 16.2 0.8 0.8 1.6-1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  read: {
    bg: "bg-indigo-100",
    fg: "text-indigo-700",
    path: (
      <>
        <path fill="currentColor" d="M7 4h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v4h4l-4-4Z" />
        <rect x="7.2" y="9.3" width="6.3" height="1.1" rx="0.55" fill="white" fillOpacity="0.85" />
        <rect x="7.2" y="11.3" width="4.9" height="1.1" rx="0.55" fill="white" fillOpacity="0.7" />
        <path fill="white" fillOpacity="0.9" d="M7.2 14.3h3.3c.3 0 .58.26.58.58v2.5c0 .32-.28.58-.58.58H7.2c-.32 0-.58-.26-.58-.58v-2.5c0-.32.26-.58.58-.58Z" />
        <path fill="white" d="M11.4 15.1 13.3 16.1 11.4 17.2Z" />
        <path d="M13.6 14.8c.55.28.85.74.85 1.35s-.3 1.07-.85 1.35" stroke="white" strokeWidth="1" strokeLinecap="round" />
        <path d="M15.0 14.4c.75.36 1.1.93 1.1 1.77 0 .84-.35 1.41-1.1 1.77" stroke="white" strokeWidth="1" strokeLinecap="round" />
      </>
    ),
  },
  brain: {
    bg: "bg-fuchsia-100",
    fg: "text-fuchsia-700",
    path: (
      <path
        fill="currentColor"
        d="M9.5 4A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H11V4H9.5Zm5 0H13v16h1.5A2.5 2.5 0 0 0 17 17.5v-11A2.5 2.5 0 0 0 14.5 4Z"
      />
    ),
  },
  owl: {
    bg: "bg-fuchsia-100",
    fg: "text-fuchsia-700",
    path: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="white" />
        <g fill="currentColor">
          <path d="M7.5 9.5c0-1.7 1.4-3 3-3s3 1.3 3 3c0 .6-.2 1.1-.5 1.5-.3.4-.8.7-1.3.7s-1-.3-1.3-.7c-.3-.4-.5-.9-.5-1.5z" />
          <path d="M6 13c0-1.9 3-2.8 6-2.8s6 .9 6 2.8c0 .9-1 2-3 2s-3-1-3-1-1.3 1-3 1-3-1.1-3-2z" />
          <circle cx="9.5" cy="9.3" r="1" fill="currentColor" />
          <circle cx="14.5" cy="9.3" r="1" fill="currentColor" />
          <path d="M12 11.2c.4.5.6 1 0 1.6-.6.6-1.4.6-2 0-.6-.6-.4-1.1 0-1.6.4-.5 1.2-.5 2 0z" fill="currentColor" />
        </g>
      </>
    ),
  },
  mail: {
    bg: "bg-blue-100",
    fg: "text-blue-700",
    path: <path fill="currentColor" d="M5 6h14a1 1 0 0 1 1 1v10H4V7a1 1 0 0 1 1-1Zm13 2.24-6 3.51-6-3.5V8l6 3.5 6-3.5v.24Z" />,
  },
  credit: {
    bg: "bg-slate-100",
    fg: "text-slate-700",
    path: <path fill="currentColor" d="M4 6h16a1 1 0 0 1 1 1v10H3V7a1 1 0 0 1 1-1Zm1.5 4.5v1.5h5v-1.5h-5Zm0 3v1.5h3v-1.5h-3Z" />,
  },
  hub: {
    bg: "bg-orange-100",
    fg: "text-orange-700",
    path: (
      <>
        <circle cx="12" cy="6.2" r="2.1" fill="currentColor" />
        <circle cx="6.2" cy="13.8" r="1.9" fill="currentColor" />
        <circle cx="17.8" cy="13.8" r="1.9" fill="currentColor" />
        <circle cx="12" cy="18.2" r="1.4" fill="currentColor" />
        <path d="M7.8 12.6 10.6 9M16.2 12.6 13.4 9M10.2 13.7l3.7.2M8 14.6l2.7 1.6m5.3-1.6-2.7 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
  },
};

function ProductIcon({ icon }: { icon?: WorkspaceProduct["icon"]; name?: string }) {
  const cfg = icon ? ICONS[icon] : ICONS.doc;

  return (
    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-white/60 shadow-sm">
      <svg viewBox="0 0 24 24" className={`h-13 w-13 ${cfg.fg}`} aria-hidden style={{ transform: "translateX(0.5px)" }}>
        {cfg.path}
      </svg>
    </div>
  );
}

export default function ProductsStrip() {
  return (
    <section id="produtos" className="py-14 bg-white">
      <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-slate-900">O Knexspace One inclui:</h2>
          <p className="text-lg text-slate-600">
            Ecossistema integrado para aulas, lives, arquivos, colaboração, automação e IA, com métricas e segurança para
            escalar sua instituição.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 justify-items-center">
          {PRODUCTS.map((p, idx) => {
            const color = CARD_COLORS[idx] ?? CARD_COLORS[CARD_COLORS.length - 1];
            return (
              <Link
                key={p.id}
                href={`/branding/${p.slug}`}
                className="group w-full rounded-2xl border-2 border-[var(--card-color)] p-4 shadow-md transition transform hover:-translate-y-2 hover:scale-[1.2] hover:ring-2 hover:ring-white/70 hover:border-black flex flex-col items-center gap-2 text-center text-white no-underline hover:no-underline focus:no-underline"
                style={{ backgroundColor: color, ["--card-color" as string]: color }}
              >
                <ProductIcon icon={p.icon} />
                <div className="h-5 max-w-full truncate text-sm font-semibold leading-5 text-white drop-shadow-sm">
                  {p.name}
                </div>
                <div className="text-xs text-white/90 leading-relaxed">{p.description}</div>
                <span className="mt-1 inline-flex w-fit rounded-full bg-white/20 px-2 py-0.5 text-[11px] text-white group-hover:bg-white/30">
                  {CATEGORY_LABEL[p.category]}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
