
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getProductBaseUrl } from "@/lib/productBase";
import { getProduct } from "@/lib/products";

type LobbyNavProps = {
  productSlug: string;
  productName: string;
  testLabel?: string;
  loginHref?: string;
};

type MenuKey = "produtos" | "solucoes" | "setores" | "recursos";

const PRODUCT_GRID = [
  { name: "VioClass", slug: "vioclass", description: "Cursos e trilhas de aulas em vídeo." },
  { name: "VioLive", slug: "violive", description: "Aulas e mentorias ao vivo." },
  { name: "VioHub", slug: "viohub", description: "Produção audiovisual e entrega." },
  { name: "SupaDrive", slug: "supadrive", description: "Armazenamento de arquivos." },
  { name: "VioRead", slug: "vioread", description: "Leitura assistida de PDFs e artigos." },
  { name: "KnexAI", slug: "knexai", description: "Camada unificada de IA." },
  { name: "KnexMail", slug: "knexmail", description: "E-mails e campanhas." },
  { name: "KnexDocs", slug: "knexdocs", description: "Documentos colaborativos." },
  { name: "KnexFlow", slug: "knexflow", description: "Automação e orquestração." },
  { name: "KnexSearch", slug: "knexsearch", description: "Busca unificada." },
  { name: "KnexChat", slug: "knexchat", description: "Chat e mensagens." },
  { name: "KnexReview", slug: "knexreview", description: "Revisão sistemática." },
  { name: "KnexPay", slug: "knexpay", description: "Cobrança e pagamentos." },
  { name: "VioAnalytics", slug: "vioanalytics", description: "Métricas e analytics educacionais." },
  { name: "VioRecord", slug: "viorecord", description: "Gravação de aulas e sessões." },
  { name: "VioStudio", slug: "viostudio", description: "Criação e edição avançada em estúdio." },
];

const PRODUCT_ICONS: Record<string, { bg: string; fg: string; node: JSX.Element }> = {
  vioclass: {
    bg: "bg-indigo-100",
    fg: "text-indigo-700",
    node: (
      <>
        <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2" fill="white" />
        <rect x="5.2" y="5.8" width="13.6" height="8.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="9.9" r="1.7" fill="currentColor" />
        <rect x="10.4" y="11.7" width="3.2" height="2.8" rx="0.8" fill="currentColor" />
        <rect x="5.2" y="16.1" width="13.6" height="1.7" rx="0.7" fill="currentColor" />
      </>
    ),
  },
  violive: {
    bg: "bg-rose-100",
    fg: "text-rose-700",
    node: (
      <>
        <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="5.6" fill="white" />
        <rect x="4.6" y="10.1" width="11.8" height="8.2" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="7.2" cy="6.1" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="13.1" cy="5.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
  },
  viohub: {
    bg: "bg-orange-100",
    fg: "text-orange-700",
    node: (
      <>
        <circle cx="12" cy="6.5" r="2.1" fill="currentColor" />
        <circle cx="6.5" cy="14" r="2" fill="currentColor" />
        <circle cx="17.5" cy="14" r="2" fill="currentColor" />
        <path d="M8.2 12.6 10.7 8.9M15.9 12.6 13.3 8.9M10.2 13.9l3.6.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
  },
  supadrive: {
    bg: "bg-blue-100",
    fg: "text-blue-700",
    node: (
      <>
        <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" />
        <path d="M8.5 13.5c0-.9.7-1.6 1.6-1.6.6 0 1.1.3 1.8 1l.2.2.2-.2c.7-.7 1.2-1 1.8-1 1 0 1.7.7 1.7 1.6s-.7 1.6-1.7 1.6c-.6 0-1.1-.3-1.8-1l-.2-.2-.2.2c-.7.7-1.2 1-1.8 1-.9 0-1.6-.7-1.6-1.6Z" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  vioread: {
    bg: "bg-indigo-100",
    fg: "text-indigo-700",
    node: (
      <>
        <path fill="currentColor" d="M7 4h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v4h4l-4-4Z" />
        <rect x="7.2" y="9.3" width="6.3" height="1.1" rx="0.55" fill="white" fillOpacity="0.85" />
      </>
    ),
  },
  knexai: {
    bg: "bg-fuchsia-100",
    fg: "text-fuchsia-700",
    node: <path fill="currentColor" d="M9.5 4A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H11V4H9.5Zm5 0H13v16h1.5A2.5 2.5 0 0 0 17 17.5v-11A2.5 2.5 0 0 0 14.5 4Z" />,
  },
  knexmail: {
    bg: "bg-red-100",
    fg: "text-red-700",
    node: (
      <g fill="currentColor">
        <path d="M5 5h14v14H5V5Zm2 2.5 5 3 5-3v-1l-5 3-5-3v1Z" />
      </g>
    ),
  },
  knexdocs: {
    bg: "bg-sky-100",
    fg: "text-sky-700",
    node: (
      <>
        <path fill="currentColor" d="M6.5 4h7l3.5 3.5V18a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v3.5H17L13.5 4Z" />
        <rect x="8" y="9" width="6.5" height="1.2" rx="0.6" fill="white" fillOpacity="0.85" />
      </>
    ),
  },
  knexflow: {
    bg: "bg-emerald-100",
    fg: "text-emerald-700",
    node: <path fill="currentColor" d="M5 5h14v14H5V5Zm2 2.5v9h2v-9H7Zm4 0v4h2v-4h-2Zm4 0v6.5h2v-6.5h-2Z" />,
  },
  knexsearch: {
    bg: "bg-purple-100",
    fg: "text-purple-700",
    node: <path fill="currentColor" d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm5.5 11.1 3.4 3.4-1.4 1.4-3.4-3.4 1.4-1.4Z" />,
  },
  knexchat: {
    bg: "bg-teal-100",
    fg: "text-teal-700",
    node: <path fill="currentColor" d="M5 5h14v9H9l-4 4V5Zm2.5 3.5v1.5h9V8.5h-9Zm0 3v1.5h6V11.5h-6Z" />,
  },
  knexreview: {
    bg: "bg-emerald-100",
    fg: "text-emerald-700",
    node: (
      <>
        <path fill="currentColor" d="M7 4h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v4h4l-4-4Z" />
        <circle cx="16.8" cy="16.2" r="1.8" fill="white" />
      </>
    ),
  },
  knexpay: {
    bg: "bg-amber-100",
    fg: "text-amber-700",
    node: (
      <>
        <rect x="6" y="7" width="12" height="10" rx="2" fill="currentColor" />
        <rect x="7.5" y="10" width="9" height="1.6" rx="0.8" fill="white" />
      </>
    ),
  },
  vioanalytics: {
    bg: "bg-cyan-100",
    fg: "text-cyan-700",
    node: (
      <>
        <path fill="currentColor" d="M6.5 5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11A1.5 1.5 0 0 1 6.5 5Z" />
        <rect x="7.5" y="12.8" width="1.8" height="4.2" rx="0.6" fill="white" />
        <rect x="10.1" y="11.2" width="1.8" height="5.8" rx="0.6" fill="white" fillOpacity="0.85" />
        <rect x="12.7" y="9.7" width="1.8" height="7.3" rx="0.6" fill="white" fillOpacity="0.7" />
        <rect x="15.3" y="8.5" width="1.8" height="8.5" rx="0.6" fill="white" fillOpacity="0.55" />
      </>
    ),
  },
  viorecord: {
    bg: "bg-red-100",
    fg: "text-red-700",
    node: (
      <>
        <rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.4" fill="currentColor" />
      </>
    ),
  },
  viostudio: {
    bg: "bg-red-100",
    fg: "text-red-700",
    node: (
      <g fill="currentColor">
        <path d="M5 5h9v2H5v10h10v-5h2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        <path d="M19.7 5.3 17.2 2.8a1 1 0 0 0-1.4 0L13 5.6V9h3.4l2.9-2.9a1 1 0 0 0 0-1.4Z" />
      </g>
    ),
  },
};

const SIDE_LINKS = [
  { title: "Implantação assistida", desc: "Onboarding guiado para sua equipe.", href: "/lobby/info/implantacao-assistida" },
  { title: "Segurança e compliance", desc: "Governança, auditoria e LGPD em dia.", href: "/lobby/info/seguranca-compliance" },
  { title: "Suporte premium", desc: "Time dedicado para dúvidas e incidentes.", href: "/lobby/info/suporte-premium" },
  { title: "Integrações", desc: "APIs, SSO e conectores prontos.", href: "/lobby/info/integracoes" },
];

const SOLUTIONS_COLUMNS = [
  {
    title: "Para indivíduos",
    items: [{ title: "Visão geral", desc: "Workspace para uso individual.", href: "/lobby/solucoes/visao-geral-individuos" }],
  },
  {
    title: "Para pequenas e médias empresas",
    items: [
      { title: "Visão geral", desc: "Workspace para equipes e PMEs.", href: "/lobby/solucoes/visao-geral-pmes" },
      { title: "Pequenas empresas", desc: "Produtividade para times menores.", href: "/lobby/solucoes/pequenas-empresas" },
      { title: "Novas empresas", desc: "Lançamento rápido com fluxos prontos.", href: "/lobby/solucoes/novas-empresas" },
      { title: "Startups", desc: "Ferramentas e colaboração enxuta.", href: "/lobby/solucoes/startups" },
    ],
  },
  {
    title: "Para grandes empresas",
    items: [
      { title: "Visão geral", desc: "Workspace para grandes operações.", href: "/lobby/solucoes/visao-geral-enterprise" },
      { title: "Equipe de atendimento", desc: "Fluxos para suporte e operações.", href: "/lobby/solucoes/equipe-atendimento" },
      { title: "Work Safer", desc: "Segurança reforçada e governança.", href: "/lobby/solucoes/work-safer" },
    ],
  },
];

const SOLUTIONS_RIGHT = [
  { title: "Desenvolvedores", href: "/lobby/solucoes/desenvolvedores" },
  { title: "Educação", href: "/lobby/solucoes/educacao" },
  { title: "Organizações sem fins lucrativos", href: "/lobby/solucoes/organizacoes-sem-fins-lucrativos" },
];

const SETORES_LIST = [
  { title: "Saúde e ciências biológicas", href: "/lobby/setores/saude-e-ciencias-biologicas" },
  { title: "Varejo", href: "/lobby/setores/varejo" },
  { title: "Indústria", href: "/lobby/setores/manufatura" },
  { title: "Governo e setor público", href: "/lobby/setores/governo-setor-publico" },
  { title: "Serviços profissionais", href: "/lobby/setores/servicos-profissionais" },
  { title: "Tecnologia", href: "/lobby/setores/tecnologia" },
  { title: "Financial Services", href: "/lobby/setores/servicos-financeiros" },
];

const DEPARTAMENTOS_LIST = [
  { title: "Vendas", href: "/lobby/setores/vendas" },
  { title: "Marketing", href: "/lobby/setores/marketing" },
  { title: "Recursos Humanos", href: "/lobby/setores/recursos-humanos" },
];

export default function LobbyNav({ productSlug, productName, testLabel, loginHref }: LobbyNavProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [appBase] = useState(() => getProductBaseUrl(productSlug));
  const product = getProduct(productSlug);
  const productPath = product?.homePath ?? `/${productSlug}`;
  const defaultFrom = appBase ? `${appBase}${productPath}` : productPath;
  const loginLink =
    loginHref ?? `/knexit-workspace/acesso?returnTo=${encodeURIComponent(defaultFrom)}`;
  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (ev: MouseEvent) => {
      if (!navRef.current) return;
      if (!openMenu) return;
      if (!navRef.current.contains(ev.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [openMenu]);

  const pillBase =
    "inline-flex items-center justify-center rounded-full px-3 py-2 text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 no-underline hover:no-underline";
  const toggleMenu = (key: MenuKey) => setOpenMenu((m) => (m === key ? null : key));
  const panelBase =
    "absolute left-0 right-0 top-full z-20 w-full max-w-none border border-slate-200 bg-white shadow-lg rounded-none overflow-hidden";

  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="relative flex w-full items-center px-4 py-3 md:px-6">
        <div className="flex items-center gap-6 flex-shrink-0">
          <Link href="/knexit-workspace" className="text-xl font-bold text-blue-700 no-underline hover:no-underline">
            KnexIT Workspace
          </Link>
        </div>
        <div className="hidden md:flex flex-1 items-center gap-3 text-sm font-semibold text-slate-700 pl-6" ref={navRef}>
          <div className="flex">
            <button
              type="button"
              className={`${pillBase} flex-col gap-0.5 ${openMenu === "solucoes" ? "bg-indigo-50 text-indigo-700" : ""}`}
              onClick={() => toggleMenu("solucoes")}
            >
              <span>Soluções</span>
              {openMenu === "solucoes" ? (
                <span aria-hidden className="text-[11px] leading-none">▾</span>
              ) : null}
            </button>
            {openMenu === "solucoes" ? (
              <div className={panelBase}>
                <button
                  type="button"
                  className="absolute right-4 top-4 text-slate-500 hover:text-slate-700 text-lg"
                  onClick={() => toggleMenu("solucoes")}
                  aria-label="Fechar soluções"
                >
                  ×
                </button>
                <div className="grid w-full grid-cols-[2fr_1fr] items-stretch">
                  <div className="border-r border-slate-200 bg-white h-full">
                    <div className="px-8 py-6 flex flex-col">
                      <div className="text-lg font-semibold text-slate-900">Soluções</div>
                      <div className="border-b border-slate-200 my-5" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {SOLUTIONS_COLUMNS.map((col) => (
                          <div key={col.title} className="space-y-8">
                            <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{col.title}</div>
                            <div className="space-y-10">
                              {col.items.map((item) => (
                                <Link key={item.title} href={item.href} className="block space-y-2 no-underline">
                                  <div className="text-sm font-semibold text-slate-900 hover:text-indigo-700">{item.title}</div>
                                  <div className="text-[12px] text-slate-600 leading-relaxed">{item.desc}</div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="px-10 py-8 flex flex-col gap-6 bg-slate-100 h-full">
                    <div className="text-[13px] font-semibold text-slate-800">Outros públicos</div>
                    <div className="space-y-5">
                      {SOLUTIONS_RIGHT.map((item) => (
                        <Link
                          key={item.title}
                          href={item.href}
                          className="block text-sm font-semibold text-slate-900 no-underline hover:text-indigo-700"
                        >
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex">
            <button
              type="button"
              className={`${pillBase} flex-col gap-0.5 ${openMenu === "produtos" ? "bg-indigo-50 text-indigo-700" : ""}`}
              onClick={() => toggleMenu("produtos")}
            >
              <span>Produtos</span>
              {openMenu === "produtos" ? (
                <span aria-hidden className="text-[11px] leading-none">▾</span>
              ) : null}
            </button>
            {openMenu === "produtos" ? (
              <div className={panelBase}>
                <div className="grid w-full grid-cols-[2fr_1fr] items-stretch">
                  <div className="border-r border-slate-200 bg-white h-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5 place-items-center">
                      {PRODUCT_GRID.map((p) => (
                        <Link
                          key={p.slug}
                          href={`/lobby/${p.slug}`}
                          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white p-3 hover:-translate-y-0.5 hover:shadow-md transition no-underline hover:no-underline"
                        >
                          <div className="flex items-center gap-3 text-left">
                            <span
                              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${PRODUCT_ICONS[p.slug]?.bg ?? "bg-slate-100"} ${PRODUCT_ICONS[p.slug]?.fg ?? "text-slate-700"}`}
                              aria-hidden
                            >
                              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                                {PRODUCT_ICONS[p.slug]?.node}
                              </svg>
                            </span>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                              <div className="text-[11px] text-slate-600 mt-0.5">{p.description}</div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col gap-3 bg-slate-50 h-full">
                    {SIDE_LINKS.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        className="group inline-flex w-[240px] flex-col rounded-lg border border-transparent bg-transparent p-3 no-underline transition hover:border-slate-200 hover:bg-white self-start"
                      >
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{item.title}</div>
                        <div className="text-[11px] text-slate-600 mt-1">{item.desc}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex">
            <button
              type="button"
              className={`${pillBase} flex-col gap-0.5 ${openMenu === "setores" ? "bg-indigo-50 text-indigo-700" : ""}`}
              onClick={() => toggleMenu("setores")}
            >
              <span>Setores</span>
              {openMenu === "setores" ? (
                <span aria-hidden className="text-[11px] leading-none">▾</span>
              ) : null}
            </button>
            {openMenu === "setores" ? (
              <div className={panelBase}>
                <button
                  type="button"
                  className="absolute right-4 top-4 text-slate-500 hover:text-slate-700 text-lg"
                  onClick={() => toggleMenu("setores")}
                  aria-label="Fechar setores"
                >
                  ×
                </button>
                <div className="grid w-full grid-cols-[2fr_1fr] items-stretch">
                  <div className="border-r border-slate-200 bg-white h-full">
                    <div className="px-8 py-6 flex flex-col">
                      <div className="text-lg font-semibold text-slate-900">Setores</div>
                      <div className="border-b border-slate-200 my-5" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-8">
                          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Setores</div>
                          <div className="space-y-10">
                            {SETORES_LIST.map((item) => (
                              <Link
                                key={item.title}
                                href={item.href}
                                className="block text-sm font-semibold text-slate-900 hover:text-indigo-700 no-underline"
                              >
                                {item.title}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-8">
                          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Departamentos</div>
                          <div className="space-y-10">
                            {DEPARTAMENTOS_LIST.map((item) => (
                              <Link
                                key={item.title}
                                href={item.href}
                                className="block text-sm font-semibold text-slate-900 hover:text-indigo-700 no-underline"
                              >
                                {item.title}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-10 py-8 flex flex-col gap-6 bg-slate-100 h-full">
                    <Link
                      href="/lobby/setores/seguranca"
                      className="text-sm font-semibold text-slate-900 hover:text-indigo-700 no-underline"
                    >
                      Segurança
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <Link href="/branding/knexai" className={pillBase}>
            IA
          </Link>
          <Link href="/knexit-workspace/precos" className={pillBase}>
            Preços
          </Link>

          <div className="flex">
            <button
              type="button"
              className={`${pillBase} flex-col gap-0.5 ${openMenu === "recursos" ? "bg-indigo-50 text-indigo-700" : ""}`}
              onClick={() => toggleMenu("recursos")}
            >
              <span>Recursos</span>
              {openMenu === "recursos" ? (
                <span aria-hidden className="text-[11px] leading-none">▾</span>
              ) : null}
            </button>
            {openMenu === "recursos" ? (
              <div className={panelBase}>
                <div className="grid w-full grid-cols-[2fr_1fr] items-stretch">
                  <div className="border-r border-slate-200 bg-white h-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-5">
                      <Link href="/lobby/recursos/guias-templates" className="w-full space-y-2 no-underline hover:no-underline">
                        <div className="text-sm font-semibold text-slate-900 hover:text-indigo-700">Guias e templates</div>
                        <div className="text-[12px] text-slate-600">Modelos para aulas, fluxos e comunicações.</div>
                      </Link>
                      <Link href="/lobby/recursos/base-de-conhecimento" className="w-full space-y-2 no-underline hover:no-underline">
                        <div className="text-sm font-semibold text-slate-900 hover:text-indigo-700">Base de conhecimento</div>
                        <div className="text-[12px] text-slate-600">Artigos, vídeos e treinamentos rápidos.</div>
                      </Link>
                      <Link href="/lobby/recursos/em-breve" className="w-full space-y-2 no-underline hover:no-underline">
                        <div className="text-sm font-semibold text-slate-900 hover:text-indigo-700">Em breve</div>
                        <div className="text-[12px] text-slate-600">Conteúdo adicional será inserido.</div>
                      </Link>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col gap-6 bg-slate-100 h-full">
                    <Link href="/lobby/recursos/tutoriais" className="space-y-2 no-underline hover:no-underline">
                      <div className="text-sm font-semibold text-slate-900 hover:text-indigo-700">Tutoriais</div>
                      <div className="text-[12px] text-slate-600">Passo a passo rápido para começar.</div>
                    </Link>
                    <Link href="/lobby/recursos/checklists" className="space-y-2 no-underline hover:no-underline">
                      <div className="text-sm font-semibold text-slate-900 hover:text-indigo-700">Checklists</div>
                      <div className="text-[12px] text-slate-600">Listas de verificação para equipes.</div>
                    </Link>
                    <Link href="/lobby/recursos/faq" className="space-y-2 no-underline hover:no-underline">
                      <div className="text-sm font-semibold text-slate-900 hover:text-indigo-700">FAQ</div>
                      <div className="text-[12px] text-slate-600">Dúvidas frequentes e atalhos úteis.</div>
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3 ml-auto [&_a]:no-underline [&_a:hover]:no-underline">
          <Link
            href={`/lobby/${productSlug}`}
            className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            {testLabel ?? `Teste o ${productName}`}
          </Link>
          <Link
            href={loginLink}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Fazer login
          </Link>
        </div>
      </div>
    </div>
  );
}
