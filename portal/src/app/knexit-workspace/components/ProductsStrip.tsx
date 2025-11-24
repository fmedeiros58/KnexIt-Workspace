import Link from "next/link";

export type WorkspaceProduct = {
  id: string;
  name: string;
  slug: string;
  category: "video" | "produtividade" | "ia" | "comunicacao" | "infra";
  description: string;
  icon?: "play" | "live" | "folder" | "doc" | "kanban" | "chat" | "search" | "brain" | "mail" | "credit";
};

const PRODUCTS: WorkspaceProduct[] = [
  { id: "vioclass", name: "VioClass", slug: "vioclass", category: "video", description: "Plataforma de cursos e aulas em vídeo.", icon: "play" },
  { id: "violive", name: "VioLive", slug: "violive", category: "video", description: "Aulas ao vivo e mentorias síncronas.", icon: "live" },
  { id: "viorecord", name: "VioRecord", slug: "viorecord", category: "video", description: "Grave tela, webcam e voz no navegador.", icon: "play" },
  { id: "viostudio", name: "VioStudio", slug: "viostudio", category: "video", description: "Edição online de vídeo e legendas.", icon: "play" },
  { id: "vioanalytics", name: "VioAnalytics", slug: "vioanalytics", category: "video", description: "Métricas de visualização e engajamento.", icon: "doc" },
  { id: "supadrive", name: "SupaDrive", slug: "supadrive", category: "produtividade", description: "Drive de arquivos para materiais e provas.", icon: "folder" },
  { id: "knexdocs", name: "KnexDocs", slug: "knexdocs", category: "produtividade", description: "Documentos colaborativos em tempo real.", icon: "doc" },
  { id: "knexflow", name: "KnexFlow", slug: "knexflow", category: "produtividade", description: "Tarefas, quadros e fluxos de trabalho.", icon: "kanban" },
  { id: "knexchat", name: "KnexChat", slug: "knexchat", category: "comunicacao", description: "Chat interno para times e turmas.", icon: "chat" },
  { id: "knexsearch", name: "KnexSearch", slug: "knexsearch", category: "ia", description: "Busca global com IA em aulas e arquivos.", icon: "search" },
  { id: "vioread", name: "VioRead", slug: "vioread", category: "produtividade", description: "Leitura assistida de PDFs e artigos.", icon: "doc" },
  { id: "knexreview", name: "KnexReview", slug: "knexreview", category: "produtividade", description: "Revisão sistemática de literatura.", icon: "doc" },
  { id: "knexai", name: "KnexAI", slug: "knexai", category: "ia", description: "Camada unificada de IA e assistentes.", icon: "brain" },
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

function ProductIcon({ icon, name }: { icon?: WorkspaceProduct["icon"]; name: string }) {
  const map: Record<NonNullable<WorkspaceProduct["icon"]>, IconConfig> = {
    play: { bg: "bg-indigo-50", fg: "text-indigo-700", type: "play" },
    live: { bg: "bg-rose-50", fg: "text-rose-700", type: "live" },
    folder: { bg: "bg-amber-50", fg: "text-amber-700", type: "folder" },
    doc: { bg: "bg-sky-50", fg: "text-sky-700", type: "doc" },
    kanban: { bg: "bg-emerald-50", fg: "text-emerald-700", type: "kanban" },
    chat: { bg: "bg-teal-50", fg: "text-teal-700", type: "chat" },
    search: { bg: "bg-purple-50", fg: "text-purple-700", type: "search" },
    brain: { bg: "bg-fuchsia-50", fg: "text-fuchsia-700", type: "brain" },
    mail: { bg: "bg-blue-50", fg: "text-blue-700", type: "mail" },
    credit: { bg: "bg-slate-50", fg: "text-slate-700", type: "credit" },
  };

  const cfg = icon ? map[icon] : { bg: "bg-slate-100", fg: "text-slate-700", type: "doc" };

  return (
    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${cfg.bg}`}>
      <svg viewBox="0 0 24 24" className={`h-6 w-6 ${cfg.fg}`} aria-hidden>
        {cfg.type === "play" && <path fill="currentColor" d="M9 7.5v9l7-4.5-7-4.5Z" />}
        {cfg.type === "live" && (
          <g fill="currentColor">
            <circle cx="12" cy="12" r="3" />
            <path d="M5 12a7 7 0 0 1 7-7v2A5 5 0 0 0 7 12a5 5 0 0 0 5 5v2a7 7 0 0 1-7-7Z" />
            <path d="M19 12a7 7 0 0 0-7-7v2a5 5 0 0 1 5 5 5 5 0 0 1-5 5v2a7 7 0 0 0 7-7Z" />
          </g>
        )}
        {cfg.type === "folder" && <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" />}
        {cfg.type === "doc" && (
          <path
            fill="currentColor"
            d="M7 4h7l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm6 1.5V9h3.5L13 5.5Zm-5 6h8v1.5H8Zm0 3h5v1.5H8Z"
          />
        )}
        {cfg.type === "kanban" && (
          <path fill="currentColor" d="M5 5h14v14H5V5Zm2 2.5v9h2v-9H7Zm4 0v4h2v-4h-2Zm4 0v6.5h2v-6.5h-2Z" />
        )}
        {cfg.type === "chat" && (
          <path
            fill="currentColor"
            d="M5 5h14v9H9l-4 4V5Zm2.5 3.5v1.5h9V8.5h-9Zm0 3v1.5h6V11.5h-6Z"
          />
        )}
        {cfg.type === "search" && (
          <path
            fill="currentColor"
            d="M10.5 5a5.5 5.5 0 1 1 0 11c-1.2 0-2.3-.38-3.2-1.02L4 18.5 5.5 20l3.3-3.5c.9.55 2 .86 3.2.86A7 7 0 1 0 10.5 5Z"
          />
        )}
        {cfg.type === "brain" && (
          <path
            fill="currentColor"
            d="M9.5 4A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H11V4H9.5Zm5 0H13v16h1.5A2.5 2.5 0 0 0 17 17.5v-11A2.5 2.5 0 0 0 14.5 4Z"
          />
        )}
        {cfg.type === "mail" && (
          <path
            fill="currentColor"
            d="M5 6h14a1 1 0 0 1 1 1v10H4V7a1 1 0 0 1 1-1Zm13 2.24-6 3.51-6-3.5V8l6 3.5 6-3.5v.24Z"
          />
        )}
        {cfg.type === "credit" && (
          <path
            fill="currentColor"
            d="M4 6h16a1 1 0 0 1 1 1v10H3V7a1 1 0 0 1 1-1Zm1.5 4.5v1.5h5v-1.5h-5Zm0 3v1.5h3v-1.5h-3Z"
          />
        )}
      </svg>
    </div>
  );
}

export default function ProductsStrip() {
  return (
    <section id="produtos" className="py-14 bg-white">
      <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-slate-900">O KnexIT Workspace inclui:</h2>
          <p className="text-lg text-slate-600">Suite completa de apps para aulas, arquivos, colaboração e IA.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {PRODUCTS.map((p) => (
            <Link
              key={p.id}
              href={`/${p.slug}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer flex flex-col gap-1"
            >
              <ProductIcon icon={p.icon} name={p.name} />
              <div className="text-sm font-semibold text-slate-900">{p.name}</div>
              <div className="text-xs text-slate-600">{p.description}</div>
              <span className="mt-1 inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {CATEGORY_LABEL[p.category]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
