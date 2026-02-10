"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { WORKSPACE_PRODUCTS } from "@/app/knexit-workspace/components/productsData";
import { getProduct } from "@/lib/products";

type MenuLink = {
  label: string;
  href: string;
  accent?: boolean;
  action?: "products";
};

type KnexspaceMenuProps = {
  onNavigate?: () => void;
  onProductsClick?: () => void;
  productsOpen?: boolean;
  variant?: "mobile" | "desktop";
  layout?: "full" | "actions" | "nav";
};

const MENU_LINKS: MenuLink[] = [
  { label: "Produtos", href: "/lobby", action: "products" },
  { label: "Setores", href: "/lobby/setores/seguranca" },
  { label: "IA", href: "/landing-produtos/landing-ia" },
  { label: "Preços", href: "/knexit-workspace/precos" },
  { label: "Recursos", href: "/lobby/recursos/em-breve" },
  { label: "Admin Console", href: "/admin/login", accent: true },
];

const SOLUTION_GROUPS = [
  {
    title: "Para indivíduos",
    items: [{ label: "Visão geral", href: "/lobby/solucoes/visao-geral-individuos" }],
  },
  {
    title: "Para pequenas e médias empresas",
    items: [
      { label: "Visão geral", href: "/lobby/solucoes/visao-geral-pmes" },
      { label: "Pequenas empresas", href: "/lobby/solucoes/pequenas-empresas" },
      { label: "Novas empresas", href: "/lobby/solucoes/novas-empresas" },
      { label: "Startups", href: "/lobby/solucoes/startups" },
    ],
  },
  {
    title: "Para grandes empresas",
    items: [
      { label: "Visão geral", href: "/lobby/solucoes/visao-geral-enterprise" },
      { label: "Equipe de atendimento", href: "/lobby/solucoes/equipe-atendimento" },
      { label: "Work Safer", href: "/lobby/solucoes/work-safer" },
    ],
  },
];

const SOLUTION_SIDE = [
  { label: "Desenvolvedores", href: "/lobby/solucoes/desenvolvedores" },
  { label: "Educação", href: "/lobby/solucoes/educacao" },
  { label: "Organizações sem fins lucrativos", href: "/lobby/solucoes/organizacoes-sem-fins-lucrativos" },
];

const SECTOR_LIST = [
  { label: "Saúde e ciências biológicas", href: "/lobby/setores/saude-e-ciencias-biologicas" },
  { label: "Varejo", href: "/lobby/setores/varejo" },
  { label: "Indústria", href: "/lobby/setores/manufatura" },
  { label: "Governo e setor público", href: "/lobby/setores/governo-setor-publico" },
  { label: "Serviços profissionais", href: "/lobby/setores/servicos-profissionais" },
  { label: "Tecnologia", href: "/lobby/setores/tecnologia" },
  { label: "Financial Services", href: "/lobby/setores/servicos-financeiros" },
];

const DEPARTMENT_LIST = [
  { label: "Vendas", href: "/lobby/setores/vendas" },
  { label: "Marketing", href: "/lobby/setores/marketing" },
  { label: "Recursos Humanos", href: "/lobby/setores/recursos-humanos" },
];

const RESOURCE_COLUMNS = [
  {
    title: "Conhecer",
    items: [
      { label: "Segurança e confiança", desc: "Proteja seus dados", href: "/lobby/info/seguranca-compliance" },
      { label: "Blog", desc: "Novidades e histórias sobre produtos", href: "/lobby/recursos/em-breve" },
      { label: "Histórias de clientes", desc: "Estudos de caso e vídeos", href: "/lobby/recursos/em-breve" },
    ],
  },
  {
    title: "Aprender",
    items: [
      { label: "Perguntas frequentes", desc: "Respostas para perguntas frequentes", href: "/lobby/recursos/faq" },
      { label: "Treinamento e certificação", desc: "Treinamento virtual ou presencial", href: "/lobby/recursos/tutoriais" },
      { label: "Eventos ao vivo e sob demanda", desc: "Confira eventos e webinars", href: "/lobby/recursos/em-breve" },
      { label: "Videoconferências", desc: "Saiba mais sobre o Google Meet", href: "/lobby/recursos/em-breve" },
    ],
  },
  {
    title: "Conectar",
    items: [
      { label: "Parceiros", desc: "Encontre o parceiro certo", href: "/lobby/recursos/em-breve" },
      { label: "Marketplace", desc: "Pesquise e instale apps", href: "/lobby/recursos/em-breve" },
      { label: "Integrações", desc: "Parceiros e integrações personalizadas", href: "/lobby/info/integracoes" },
      {
        label: "Programa de Indicações do Google Workspace",
        desc: "Ganhe recompensas com o Programa de Indicações",
        href: "/lobby/recursos/em-breve",
      },
    ],
  },
];

const RESOURCE_SUPPORT = [
  { label: "Suporte para admins", href: "/lobby/info/suporte-premium" },
  { label: "Suporte para usuários", href: "/lobby/recursos/faq" },
];

export default function KnexspaceMenu({
  onNavigate,
  onProductsClick,
  productsOpen = false,
  variant = "mobile",
  layout = "full",
}: KnexspaceMenuProps) {
  const pathname = usePathname() ?? "";
  const landingMatch = pathname.match(/^\/landing-produtos\/([^/?#]+)/);
  const landingSlug = landingMatch?.[1] ?? null;
  const resolvedSlug = landingSlug === "landing-ia" ? "knexai" : landingSlug;
  const landingProduct = resolvedSlug ? getProduct(resolvedSlug) : null;
  const isLanding = Boolean(landingMatch);
  const showAdmin = !isLanding;
  const landingReturnTo = landingProduct ? landingProduct.homePath : null;
  const landingLoginHref = landingReturnTo
    ? `/knexit-workspace/acesso?returnTo=${encodeURIComponent(landingReturnTo)}`
    : "/knexit-workspace/acesso?stay=1";
  const secondaryCtaLabel = isLanding
    ? `Teste o ${landingProduct?.name ?? "Knexspace"} no trabalho`
    : "Fale com a equipe de vendas";
  const secondaryCtaHref = isLanding
    ? landingLoginHref
    : "/knexit-workspace#contato";
  const primaryCtaLabel = isLanding ? "Fazer login" : "Iniciar agora";
  const primaryCtaHref =
    isLanding ? landingLoginHref : "/knexit-workspace/acesso?stay=1";
  const [desktopOpen, setDesktopOpen] = useState<"solucoes" | "setores" | "recursos" | null>(null);
  const [mobileSection, setMobileSection] = useState<
    "solucoes" | "produtos" | "setores" | "recursos" | null
  >(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [expandedSectorGroups, setExpandedSectorGroups] = useState<string[]>([]);
  const [expandedResourceGroups, setExpandedResourceGroups] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const handleProductToggle = () => {
    setDesktopOpen(null);
    onProductsClick?.();
    onNavigate?.();
  };
  const renderLink = (item: MenuLink, className: string) => {
    if (item.action === "products") {
      return (
        <button key={item.label} type="button" onClick={handleProductToggle} className={className}>
          {item.label}
        </button>
      );
    }
    return (
      <Link key={item.label} href={item.href} onClick={onNavigate} className={className}>
        {item.label}
      </Link>
    );
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      setDesktopOpen(null);
    };
    if (desktopOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [desktopOpen]);

  useEffect(() => {
    if (mobileSection !== "solucoes") {
      setExpandedGroups([]);
    }
  }, [mobileSection]);

  useEffect(() => {
    if (mobileSection !== "setores") {
      setExpandedSectorGroups([]);
    }
  }, [mobileSection]);

  useEffect(() => {
    if (mobileSection !== "recursos") {
      setExpandedResourceGroups([]);
    }
  }, [mobileSection]);

  if (variant === "desktop") {
    const getLink = (label: string) => MENU_LINKS.find((item) => item.label === label);
    const productsLink = getLink("Produtos");
    const iaLink = getLink("IA");
    const precosLink = getLink("Preços");
    const adminLink = showAdmin ? MENU_LINKS.find((item) => item.accent) : null;

    const triggerClass = (isOpen: boolean) =>
      `inline-flex flex-col items-center gap-0.5 whitespace-nowrap transition ${
        isOpen ? "text-white" : "text-white/90 hover:text-white"
      }`;

    const productsTrigger = (
      <div className="relative">
        <button
          type="button"
          onClick={handleProductToggle}
          className={triggerClass(productsOpen)}
          aria-expanded={productsOpen}
        >
          <span>Produtos</span>
          {productsOpen ? <span className="text-[11px] leading-none">▾</span> : null}
        </button>
      </div>
    );

    const solutionsTrigger = (
      <div className="relative">
        <button
          type="button"
          onClick={() => setDesktopOpen((prev) => (prev === "solucoes" ? null : "solucoes"))}
          className={triggerClass(desktopOpen === "solucoes")}
          aria-expanded={desktopOpen === "solucoes"}
        >
          <span>Soluções</span>
          {desktopOpen === "solucoes" ? <span className="text-[11px] leading-none">▾</span> : null}
        </button>
        {desktopOpen === "solucoes" ? (
          <div className="fixed left-0 right-0 top-[3.85rem] z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-200 bg-white shadow-xl -mt-px md:overflow-visible">
            <div className="relative">
              <div
                className="pointer-events-none absolute right-0 top-0 hidden h-full md:block md:w-[clamp(0px,calc((100vw-72rem)/2),9999px)] bg-slate-100"
                aria-hidden
              />
              <button
                type="button"
                onClick={() => setDesktopOpen(null)}
                className="absolute right-4 top-2 text-3xl font-semibold text-slate-500 transition hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
              <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-[clamp(1.5rem,4vw,3rem)]">
                <div className="flex flex-col gap-6 border-t border-slate-200 pb-6 pt-6 md:flex-row md:items-start md:gap-8">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Soluções</h3>
                    </div>
                    <div className="mt-4 border-t border-slate-200 pt-5">
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {SOLUTION_GROUPS.map((group) => (
                          <div key={group.title} className="space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              {group.title}
                            </p>
                            <div className="space-y-2">
                              {group.items.map((item) => (
                                <Link
                                  key={item.label}
                                  href={item.href}
                                  className="block text-sm font-semibold text-slate-900 hover:text-blue-600 no-underline hover:no-underline"
                                >
                                  {item.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 md:-mb-6 md:-mt-6 md:w-[32%] md:max-w-[320px] md:self-stretch md:pb-6 md:pt-6 md:pr-[clamp(1.5rem,4vw,3rem)] md:-mr-[clamp(1.5rem,4vw,3rem)] md:border-t">
                    <aside className="w-full border-t border-slate-100 pt-6 text-sm md:h-full md:border-t-0 md:border-l md:pl-6">
                      <div className="space-y-4">
                        {SOLUTION_SIDE.map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            className="block text-sm font-semibold text-slate-900 hover:text-blue-600 no-underline hover:no-underline"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </aside>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );

    const setoresTrigger = (
      <div className="relative">
        <button
          type="button"
          onClick={() => setDesktopOpen((prev) => (prev === "setores" ? null : "setores"))}
          className={triggerClass(desktopOpen === "setores")}
          aria-expanded={desktopOpen === "setores"}
        >
          <span>Setores</span>
          {desktopOpen === "setores" ? <span className="text-[11px] leading-none">▾</span> : null}
        </button>
        {desktopOpen === "setores" ? (
          <div className="fixed left-0 right-0 top-[3.85rem] z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-200 bg-white shadow-xl -mt-px md:overflow-visible">
            <div className="relative">
              <div
                className="pointer-events-none absolute right-0 top-0 hidden h-full md:block md:w-[clamp(0px,calc((100vw-72rem)/2),9999px)] bg-slate-100"
                aria-hidden
              />
              <button
                type="button"
                onClick={() => setDesktopOpen(null)}
                className="absolute right-4 top-2 text-3xl font-semibold text-slate-500 transition hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
              <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-[clamp(1.5rem,4vw,3rem)]">
                <div className="flex flex-col gap-6 border-t border-slate-200 pb-6 pt-6 md:flex-row md:items-start md:gap-8">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Setores</h3>
                    </div>
                    <div className="mt-4 border-t border-slate-200 pt-5">
                      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                        <div className="space-y-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Setores
                          </p>
                          <div className="space-y-4">
                            {SECTOR_LIST.map((item) => (
                              <Link
                                key={item.label}
                                href={item.href}
                                className="block text-sm font-semibold text-slate-900 hover:text-blue-600 no-underline hover:no-underline"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Departamentos
                          </p>
                          <div className="space-y-4">
                            {DEPARTMENT_LIST.map((item) => (
                              <Link
                                key={item.label}
                                href={item.href}
                                className="block text-sm font-semibold text-slate-900 hover:text-blue-600 no-underline hover:no-underline"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 md:-mb-6 md:-mt-6 md:w-[32%] md:max-w-[320px] md:self-stretch md:pb-6 md:pt-6 md:pr-[clamp(1.5rem,4vw,3rem)] md:-mr-[clamp(1.5rem,4vw,3rem)] md:border-t">
                    <aside className="w-full border-t border-slate-100 pt-6 text-sm md:h-full md:border-t-0 md:border-l md:pl-6">
                      <div className="space-y-4">
                        <Link
                          href="/lobby/setores/seguranca"
                          className="block text-sm font-semibold text-slate-900 hover:text-blue-600 no-underline hover:no-underline"
                        >
                          Segurança
                        </Link>
                      </div>
                    </aside>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );

    const recursosTrigger = (
      <div className="relative">
        <button
          type="button"
          onClick={() => setDesktopOpen((prev) => (prev === "recursos" ? null : "recursos"))}
          className={triggerClass(desktopOpen === "recursos")}
          aria-expanded={desktopOpen === "recursos"}
        >
          <span>Recursos</span>
          {desktopOpen === "recursos" ? <span className="text-[11px] leading-none">▾</span> : null}
        </button>
        {desktopOpen === "recursos" ? (
          <div className="fixed left-0 right-0 top-[3.85rem] z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-200 bg-white shadow-xl -mt-px md:overflow-visible">
            <div className="relative">
              <div
                className="pointer-events-none absolute right-0 top-0 hidden h-full md:block md:w-[clamp(0px,calc((100vw-72rem)/2),9999px)] bg-slate-100"
                aria-hidden
              />
              <button
                type="button"
                onClick={() => setDesktopOpen(null)}
                className="absolute right-4 top-2 text-3xl font-semibold text-slate-500 transition hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
              <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-[clamp(1.5rem,4vw,3rem)]">
                <div className="flex flex-col gap-6 border-t border-slate-200 pb-6 pt-6 md:flex-row md:items-start md:gap-8">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Recursos</h3>
                    </div>
                    <div className="mt-4 border-t border-slate-200 pt-5">
                      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                        {RESOURCE_COLUMNS.map((column) => (
                          <div key={column.title} className="space-y-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              {column.title}
                            </p>
                            <div className="space-y-4">
                              {column.items.map((item) => (
                                <Link
                                  key={item.label}
                                  href={item.href}
                                  className="block space-y-1 no-underline hover:no-underline"
                                >
                                  <div className="text-sm font-semibold text-slate-900 hover:text-blue-600">
                                    {item.label}
                                  </div>
                                  <div className="text-[12px] text-slate-600">{item.desc}</div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 md:-mb-6 md:-mt-6 md:w-[32%] md:max-w-[320px] md:self-stretch md:pb-6 md:pt-6 md:pr-[clamp(1.5rem,4vw,3rem)] md:-mr-[clamp(1.5rem,4vw,3rem)] md:border-t">
                    <aside className="w-full border-t border-slate-100 pt-6 text-sm md:h-full md:border-t-0 md:border-l md:pl-6">
                      <div className="space-y-4">
                        {RESOURCE_SUPPORT.map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            className="block text-sm font-semibold text-slate-900 hover:text-blue-600 no-underline hover:no-underline"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </aside>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );

    if (layout === "actions") {
      return (
        <div className="hidden md:flex w-full items-center justify-end gap-6 text-[13px] font-semibold lg:gap-7 lg:text-[15px] xl:hidden">
          <Link
            href={secondaryCtaHref}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/80 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white no-underline transition-colors hover:border-slate-300 hover:bg-white hover:text-[#2F7E95] hover:no-underline lg:text-[14px]"
          >
            {secondaryCtaLabel}
          </Link>
          <Link
            href={primaryCtaHref}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#2F7E95] shadow-sm no-underline hover:bg-white/90 hover:no-underline lg:text-[14px]"
          >
            {primaryCtaLabel}
          </Link>
        </div>
      );
    }

    if (layout === "nav") {
      return (
        <div
          ref={panelRef}
          className="hidden md:flex w-full items-center gap-6 text-[13px] font-semibold text-white lg:gap-7 lg:text-[15px] xl:hidden"
        >
          {solutionsTrigger}
          <nav className="flex items-center gap-6 lg:gap-7">
            {productsLink ? productsTrigger : null}
            {setoresTrigger}
            {iaLink ? renderLink(iaLink, "whitespace-nowrap text-white/90 no-underline hover:text-white hover:no-underline") : null}
            {precosLink
              ? renderLink(precosLink, "whitespace-nowrap text-white/90 no-underline hover:text-white hover:no-underline")
              : null}
            {recursosTrigger}
          </nav>
          {adminLink ? (
            <Link
              key={adminLink.label}
              href={adminLink.href}
              className="ml-auto whitespace-nowrap text-white no-underline hover:text-white hover:no-underline"
            >
              {adminLink.label}
            </Link>
          ) : null}
        </div>
      );
    }

    return (
      <div
        ref={panelRef}
        className="hidden xl:flex w-full items-center gap-6 text-[13px] font-semibold text-white lg:text-[15px]"
      >
        <div className="flex items-center gap-6 pl-12">
          {solutionsTrigger}
          <nav className="flex items-center gap-6 lg:gap-7">
            {productsLink ? productsTrigger : null}
            {setoresTrigger}
            {iaLink ? renderLink(iaLink, "whitespace-nowrap text-white/90 no-underline hover:text-white hover:no-underline") : null}
            {precosLink
              ? renderLink(precosLink, "whitespace-nowrap text-white/90 no-underline hover:text-white hover:no-underline")
              : null}
            {recursosTrigger}
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-6 text-[13px] font-semibold lg:gap-7 lg:text-[15px]">
          {adminLink ? (
            <Link
              key={adminLink.label}
              href={adminLink.href}
              className="whitespace-nowrap text-white no-underline hover:text-white hover:no-underline"
            >
              {adminLink.label}
            </Link>
          ) : null}
          <Link
            href={secondaryCtaHref}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/80 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white no-underline transition-colors hover:border-slate-300 hover:bg-white hover:text-[#2F7E95] hover:no-underline lg:text-[14px]"
          >
            {secondaryCtaLabel}
          </Link>
          <Link
            href={primaryCtaHref}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#2F7E95] shadow-sm no-underline hover:bg-white/90 hover:no-underline lg:text-[14px]"
          >
            {primaryCtaLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-0 py-0">
      <button
        type="button"
        onClick={() => setMobileSection(mobileSection === "solucoes" ? null : "solucoes")}
        className="flex w-full items-center justify-between pl-4 pr-4 py-3 text-sm font-semibold leading-normal text-slate-900"
      >
        Soluções
        <ChevronDown className={`h-4 w-4 transition ${mobileSection === "solucoes" ? "rotate-180" : ""}`} />
      </button>
      {mobileSection === "solucoes" ? (
        <>
            <div className="px-4 py-0">
            {SOLUTION_GROUPS.map((group) => {
              const isOpen = expandedGroups.includes(group.title);
              return (
                <div key={group.title}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroups((prev) =>
                        isOpen ? prev.filter((title) => title !== group.title) : [...prev, group.title]
                      )
                    }
                    className="flex w-full items-center justify-between py-3 pl-10 text-left text-sm font-semibold leading-normal text-slate-900"
                  >
                    <span className="text-sm font-semibold leading-normal">{group.title}</span>
                    <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen ? (
                    <div>
                      {group.items.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={onNavigate}
                          className="block py-3 pl-16 text-sm font-semibold leading-normal text-slate-900 no-underline hover:text-blue-600 hover:no-underline"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="bg-slate-100 px-4 py-0">
            <div className="pl-2">
              {SOLUTION_SIDE.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  className="block py-3 text-sm font-semibold leading-normal text-slate-900 no-underline hover:text-blue-600 hover:no-underline"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setMobileSection(mobileSection === "produtos" ? null : "produtos")}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold leading-normal text-slate-900"
      >
        Produtos
        <ChevronDown className={`h-4 w-4 transition ${mobileSection === "produtos" ? "rotate-180" : ""}`} />
      </button>
      {mobileSection === "produtos" ? (
        <div className="px-4 py-0">
          <div className="pl-2">
            {WORKSPACE_PRODUCTS.map((product) => (
              <Link
                key={product.slug}
                href={`/landing-produtos/${product.slug}`}
                onClick={onNavigate}
                className="flex items-start gap-3 py-3 text-sm font-semibold leading-normal text-slate-900 no-underline hover:text-blue-600 hover:no-underline"
              >
                <Image
                  src={`/knexit-workspace/product-icons/${product.icon ?? "doc"}.svg`}
                  alt={product.name}
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
                <span>{product.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setMobileSection(mobileSection === "setores" ? null : "setores")}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold leading-normal text-slate-900"
      >
        Setores
        <ChevronDown className={`h-4 w-4 transition ${mobileSection === "setores" ? "rotate-180" : ""}`} />
      </button>
      {mobileSection === "setores" ? (
        <div className="px-4 py-0">
          <div className="pl-2">
            {[
              { title: "Setores", items: SECTOR_LIST },
              { title: "Departamentos", items: DEPARTMENT_LIST },
              { title: "Segurança", items: [{ label: "Segurança", href: "/lobby/setores/seguranca" }] },
            ].map((group) => {
              const isOpen = expandedSectorGroups.includes(group.title);
              return (
                <div key={group.title}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSectorGroups((prev) =>
                        isOpen ? prev.filter((title) => title !== group.title) : [...prev, group.title]
                      )
                    }
                    className="flex w-full items-center justify-between py-3 pl-10 text-left text-sm font-semibold leading-normal text-slate-900"
                  >
                    <span className="text-sm font-semibold leading-normal">{group.title}</span>
                    <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen ? (
                    <div>
                      {group.items.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={onNavigate}
                          className="block py-3 pl-16 text-sm font-semibold leading-normal text-slate-900 no-underline hover:text-blue-600 hover:no-underline"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="px-4 py-0">
        <div>
          {MENU_LINKS.filter((item) => item.label === "IA" || item.label === "Preços").map((item) =>
            renderLink(
              item,
              "block py-3 text-sm font-semibold leading-normal no-underline hover:no-underline text-slate-900"
            )
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setMobileSection(mobileSection === "recursos" ? null : "recursos")}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold leading-normal text-slate-900"
      >
        Recursos
        <ChevronDown className={`h-4 w-4 transition ${mobileSection === "recursos" ? "rotate-180" : ""}`} />
      </button>
      {mobileSection === "recursos" ? (
        <div className="px-4 py-0">
          <div className="pl-2">
            {RESOURCE_COLUMNS.map((column) => {
              const isOpen = expandedResourceGroups.includes(column.title);
              return (
                <div key={column.title}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedResourceGroups((prev) =>
                        isOpen ? prev.filter((title) => title !== column.title) : [...prev, column.title]
                      )
                    }
                    className="flex w-full items-center justify-between py-3 pl-10 text-left text-sm font-semibold leading-normal text-slate-900"
                  >
                    <span className="text-sm font-semibold leading-normal">{column.title}</span>
                    <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen ? (
                    <div>
                      {column.items.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={onNavigate}
                          className="block py-3 pl-16 text-sm font-semibold leading-normal text-slate-900 no-underline hover:text-blue-600 hover:no-underline"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center py-4">
            <Link
              href="/lobby/recursos"
              onClick={onNavigate}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-white hover:no-underline"
            >
              Ver mais
            </Link>
          </div>
          <div className="bg-slate-100 -mx-4 px-4 py-0">
            <div className="pl-2">
              {RESOURCE_SUPPORT.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  className="block py-3 text-sm font-semibold leading-normal text-slate-900 no-underline hover:text-blue-600 hover:no-underline"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <div className="px-4 py-0">
        <div>
          {showAdmin
            ? MENU_LINKS.filter((item) => item.label === "Admin Console").map((item) =>
                renderLink(
                  item,
                  "block py-3 text-sm font-semibold leading-normal no-underline hover:no-underline text-blue-600"
                )
              )
            : null}
        </div>
      </div>
      <div className="border-t border-slate-200/80 px-4 pt-5 pb-6">
        <div className="space-y-3">
          <Link
            href={secondaryCtaHref}
            onClick={onNavigate}
            className="flex w-full items-center justify-center rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold leading-normal text-blue-600 no-underline hover:bg-white hover:no-underline"
          >
            {secondaryCtaLabel}
          </Link>
          <Link
            href={primaryCtaHref}
            onClick={onNavigate}
            className="flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold leading-normal text-white no-underline hover:bg-blue-700 hover:no-underline"
          >
            {primaryCtaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
