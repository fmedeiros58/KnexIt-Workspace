"use client";

import { useState } from "react";

type PlanId = "starter" | "standard" | "plus" | "enterprise";

type PlanFeatureIcon =
  | "drive"
  | "mail"
  | "spark"
  | "search"
  | "video"
  | "calendar"
  | "doc"
  | "check";

type PlanFeature = {
  icon: PlanFeatureIcon;
  title: string;
  detail?: string;
};

interface Plan {
  id: PlanId;
  name: string;
  highlight?: boolean;
  badge?: string;
  price?: string;
  priceUnit?: string;
  oldPrice?: string;
  priceNote?: string[];
  description?: string;
  ctaLabel: string;
  features: PlanFeature[];
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "R$32.72",
    priceUnit: "BRL",
    oldPrice: "R$40.90",
    priceNote: ["mensais por usuario", "(contrato de um ano)"],
    ctaLabel: "Iniciar agora",
    features: [
      { icon: "drive", title: "30 GB", detail: "de armazenamento em pool por usuario*" },
      { icon: "mail", title: "E-mail comercial personalizado", detail: "voce@suaempresa.com" },
      { icon: "spark", title: "Assistente de IA Gemini no Gmail" },
      { icon: "spark", title: "Converse com a IA no app Gemini" },
      { icon: "video", title: "Videochamadas, limite de 100 participantes" },
      { icon: "check", title: "Controles de seguranca e gerenciamento" },
    ],
  },
  {
    id: "standard",
    name: "Standard",
    highlight: true,
    price: "R$81.80",
    priceUnit: "BRL",
    priceNote: ["mensais por usuario", "(contrato de um ano)"],
    ctaLabel: "Iniciar agora",
    features: [
      { icon: "drive", title: "2 TB", detail: "65x mais do que o plano Starter*" },
      {
        icon: "mail",
        title: "E-mail comercial personalizado",
        detail: "voce@suaempresa.com + layouts personalizados e mala direta",
      },
      { icon: "spark", title: "Assistente de IA Gemini no Gmail, Google Docs, Meet e outros apps" },
      { icon: "search", title: "Assistente de pesquisa com tecnologia de IA (NotebookLM)" },
      { icon: "spark", title: "Converse com a IA no app Gemini e crie sua propria equipe de especialistas" },
      { icon: "video", title: "Videochamadas com gravacao, cancelamento de ruido e limite de 150 participantes" },
      { icon: "calendar", title: "Paginas de agendamento de horario" },
      { icon: "doc", title: "Assinatura eletronica no Google Docs e em PDFs" },
      { icon: "check", title: "Ferramenta Google Workspace Migrate para migracao de dados" },
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: "R$128.40",
    priceUnit: "BRL",
    priceNote: ["mensais por usuario", "(contrato de um ano)"],
    ctaLabel: "Iniciar agora",
    features: [
      { icon: "drive", title: "5 TB", detail: "2,5x mais do que o Standard*" },
      { icon: "mail", title: "E-mail comercial personalizado", detail: "+ e-discovery" },
      { icon: "video", title: "Videochamadas com controle de presenca, limite de 500 participantes" },
      { icon: "check", title: "Vault para retencao, arquivamento e pesquisa de dados" },
      { icon: "check", title: "LDAP seguro" },
      { icon: "check", title: "Gerenciamento avancado de endpoints" },
      { icon: "check", title: "Controles aprimorados de seguranca e gerenciamento" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Entre em contato com a equipe de vendas para saber os precos",
    ctaLabel: "Fale com a equipe de vendas",
    features: [
      { icon: "drive", title: "5 TB", detail: "ou faca upgrade para ter mais*" },
      { icon: "mail", title: "E-mail comercial personalizado", detail: "+ Criptografia S/MIME" },
      { icon: "video", title: "Videochamadas com transmissao ao vivo no dominio, limite de 1.000 participantes" },
      { icon: "check", title: "Prevencao contra perda de dados (DLP)" },
      { icon: "check", title: "Acesso Baseado no Contexto (CAA)" },
      { icon: "check", title: "Regioes de dados corporativas" },
      { icon: "check", title: "Cloud Identity Premium" },
      { icon: "check", title: "Gerenciamento corporativo de endpoints" },
      { icon: "check", title: "Classificacao por IA para o Google Drive" },
      { icon: "check", title: "Assured Controls disponivel como um complemento" },
      { icon: "check", title: "Suporte avancado com respostas mais rapidas para problemas criticos" },
    ],
  },
];

const ICONS = {
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
    folder: { bg: "bg-amber-100", fg: "text-amber-700", path: <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" /> },
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
    kanban: { bg: "bg-emerald-100", fg: "text-emerald-700", path: <path fill="currentColor" d="M5 5h14v14H5V5Zm2 2.5v9h2v-9H7Zm4 0v4h2v-4h-2Zm4 0v6.5h2v-6.5h-2Z" /> },
  chat: {
    bg: "bg-teal-100",
    fg: "text-teal-700",
    path: <path fill="currentColor" d="M5 5h14v9H9l-4 4V5Zm2.5 3.5v1.5h9V8.5h-9Zm0 3v1.5h6V11.5h-6Z" />,
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
  hub: {
    bg: "bg-orange-100",
    fg: "text-orange-700",
    path: (
      <>
        <circle cx="12" cy="6.5" r="2.1" fill="currentColor" />
        <circle cx="6.5" cy="14" r="2" fill="currentColor" />
        <circle cx="17.5" cy="14" r="2" fill="currentColor" />
        <path d="M8.2 12.6 10.7 8.9M15.9 12.6 13.3 8.9M10.2 13.9l3.6.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="12" cy="18.2" r="1.4" fill="currentColor" />
        <path d="m7.6 15.5 3 1.8m2.7 0 3.2-1.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
  search: {
    bg: "bg-purple-100",
    fg: "text-purple-700",
    path: <path fill="currentColor" d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm5.5 11.1 3.4 3.4-1.4 1.4-3.4-3.4 1.4-1.4Z" />,
  },
    brain: {
      bg: "bg-fuchsia-100",
      fg: "text-fuchsia-700",
      path: <path fill="currentColor" d="M9.5 4A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H11V4H9.5Zm5 0H13v16h1.5A2.5 2.5 0 0 0 17 17.5v-11A2.5 2.5 0 0 0 14.5 4Z" />,
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
  };

type AppHighlight = {
  name: string;
  slug: string;
  icon: keyof typeof ICONS;
  detail: string;
};

const APPS: AppHighlight[] = [
  { name: "VioClass", slug: "vioclass", icon: "play", detail: "Plataforma de cursos e aulas em video." },
  { name: "VioLive", slug: "violive", icon: "live", detail: "Aulas ao vivo e mentorias sincronas." },
  { name: "VioRecord", slug: "viorecord", icon: "record", detail: "Grave tela, webcam e voz no navegador." },
  { name: "VioStudio", slug: "viostudio", icon: "edit", detail: "Edicao online de video e legendas." },
  { name: "VioAnalytics", slug: "vioanalytics", icon: "analytics", detail: "Metricas de visualizacao e engajamento." },
  { name: "VioHub", slug: "viohub", icon: "hub", detail: "Producao audiovisual integrada e entrega." },
  { name: "SupaDrive", slug: "supadrive", icon: "supadrive", detail: "Drive de arquivos para materiais e provas." },
  { name: "VioRead", slug: "vioread", icon: "read", detail: "Leitura assistida de PDFs e artigos." },
  { name: "KnexReview", slug: "knexreview", icon: "review", detail: "Revisao sistematica de literatura." },
  { name: "KnexDocs", slug: "knexdocs", icon: "doc", detail: "Documentos colaborativos em tempo real." },
  { name: "KnexFlow", slug: "knexflow", icon: "kanban", detail: "Tarefas, quadros e fluxos de trabalho." },
  { name: "KnexChat", slug: "knexchat", icon: "chat", detail: "Chat interno para times e turmas." },
  { name: "KnexSearch", slug: "knexsearch", icon: "search", detail: "Busca global com IA em aulas e arquivos." },
  { name: "KnexAI", slug: "knexai", icon: "owl", detail: "Camada unificada de IA e assistentes." },
  { name: "KnexMail", slug: "knexmail", icon: "mail", detail: "Emails transacionais e campanhas." },
  { name: "KnexPay", slug: "knexpay", icon: "credit", detail: "Billing e planos em breve." },
];

const HIGHLIGHTS = [
  {
    title: "IA premium integrada",
    description:
      "Trabalhe melhor e mais rápido com o app Gemini, o NotebookLM e o Gemini no Gmail, Documentos, Planilhas e muito mais.",
  },
  {
    title: "Ferramentas nativas da nuvem",
    description:
      "Colabore em tempo real, de qualquer dispositivo, com ferramentas sempre atualizadas.",
  },
  {
    title: "Segurança de nível empresarial",
    description:
      "Proteja seus e-mails, arquivos e reuniões com controles de compliance e segurança com tecnologia de IA.",
  },
];

const IconBadge = ({ icon, label, detail }: { icon: keyof typeof ICONS; label: string; detail: string }) => {
  const cfg = ICONS[icon];
  return (
    <div className="relative flex flex-col items-center">
      <div className="flex w-[72px] flex-col items-center rounded-xl border border-transparent bg-transparent px-1.5 py-2 text-center transition-all duration-200 sm:w-[84px] lg:w-full lg:group-hover:border-slate-200 lg:group-hover:bg-white lg:group-hover:py-3 lg:group-hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-slate-100 bg-white shadow-sm transition duration-200 lg:group-hover:scale-110 lg:group-hover:shadow-md">
          <svg viewBox="0 0 24 24" className={`h-10 w-10 ${cfg.fg}`} aria-hidden style={{ transform: "translateX(0.5px)" }}>
            {cfg.path}
          </svg>
        </div>
        <span className="mt-2 max-w-[4.5rem] truncate text-[10px] font-semibold text-slate-700 lg:group-hover:mt-3 lg:group-hover:max-w-none lg:group-hover:whitespace-normal">
          {label}
        </span>
        <div className="mt-0 max-h-0 overflow-hidden opacity-0 transition-all duration-200 lg:group-hover:mt-1 lg:group-hover:max-h-20 lg:group-hover:opacity-100">
          <div className="flex h-16 w-full flex-col items-center">
            <p className="max-h-10 overflow-hidden text-[11px] leading-snug text-slate-500">
              {detail}
            </p>
            <span className="mt-auto text-[11px] font-semibold text-blue-600">Saiba mais</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PlansSection() {
  const [activeHighlight, setActiveHighlight] = useState(0);

  return (
    <section id="planos" className="bg-[var(--kx-bg)] pt-14 pb-0">
      <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-7">
        <div className="space-y-8 text-center">
          <h2 className="mx-auto max-w-5xl px-6 text-center text-[clamp(1.75rem,5.6vw,2.75rem)] leading-tight font-bold text-slate-900 font-[family:Arial,Helvetica,sans-serif] sm:px-10 md:px-16">
            Todas as ferramentas que você precisa e algumas outras que você vai adorar.
          </h2>
          <div className="hidden gap-6 text-center md:grid md:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="mx-auto max-w-[300px] space-y-2 lg:max-w-[320px]">
                <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="text-[15px] text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4 text-left md:hidden">
            {HIGHLIGHTS.map((item, index) => {
              const isActive = activeHighlight === index;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setActiveHighlight(index)}
                  aria-expanded={isActive}
                  className={`mx-auto block w-full max-w-[520px] rounded-xl border-2 bg-white px-5 py-4 text-left transition ${
                    isActive ? "border-[#2F8FA7]" : "border-slate-200"
                  }`}
                >
                  <span className={`text-base font-semibold ${isActive ? "text-slate-900" : "text-slate-700"}`}>
                    {item.title}
                  </span>
                  {isActive ? <p className="mt-2 text-[15px] text-slate-600">{item.description}</p> : null}
                </button>
              );
            })}
          </div>
          <p className="pt-2 text-center text-lg font-semibold text-[#0F5F6E] drop-shadow-[0_0_10px_rgba(15,95,110,0.35)]">
            O Knexspace One inclui:
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-3 lg:flex-nowrap lg:items-start lg:justify-between lg:gap-0 lg:h-[208px]">
          {APPS.map((app) => (
            <a
                  key={app.slug}
                  href={`/landing-produtos/${app.slug}`}
                  className="group relative flex flex-col items-center gap-1 no-underline transition hover:no-underline focus:no-underline lg:w-12 lg:shrink-0 lg:justify-start lg:transition-[width] lg:duration-200 lg:hover:w-36 lg:hover:z-10"
                >
              <IconBadge icon={app.icon} label={app.name} detail={app.detail} />
            </a>
          ))}
        </div>

      </div>
    </section>
  );
}
