"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { WORKSPACE_PRODUCTS } from "@/app/knexit-workspace/components/productsData";

type MenuLink = {
  label: string;
  href: string;
  accent?: boolean;
  action?: "products";
};

type KnexspaceMenuProps = {
  onNavigate?: () => void;
  onProductsClick?: () => void;
  variant?: "mobile" | "desktop";
  layout?: "full" | "actions" | "nav";
};

const MENU_LINKS: MenuLink[] = [
  { label: "Produtos", href: "/lobby", action: "products" },
  { label: "Setores", href: "/lobby/setores/seguranca" },
  { label: "IA", href: "/branding/knexai" },
  { label: "Preços", href: "/knexit-workspace#planos" },
  { label: "Recursos", href: "/lobby/recursos/guias-templates" },
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

export default function KnexspaceMenu({
  onNavigate,
  onProductsClick,
  variant = "mobile",
  layout = "full",
}: KnexspaceMenuProps) {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<"solucoes" | "produtos" | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const handleProductToggle = () => {
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
      setDesktopOpen(false);
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

  if (variant === "desktop") {
    const mainLinks = MENU_LINKS.filter((item) => !item.accent);
    const adminLink = MENU_LINKS.find((item) => item.accent);

    const solutionsTrigger = (
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setDesktopOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1 whitespace-nowrap transition ${
            desktopOpen ? "text-white" : "text-white/90 hover:text-white"
          }`}
        >
          Soluções
          <ChevronDown className={`h-4 w-4 transition ${desktopOpen ? "rotate-180" : ""}`} />
        </button>
        {desktopOpen ? (
          <div className="fixed left-0 right-0 top-[3.85rem] z-40 border border-slate-200 bg-white shadow-xl -mt-px">
            <div className="relative">
              <div className="md:pr-[40vw]">
                <div className="mx-auto max-w-6xl pl-[4.5rem] pr-4 pt-6 pb-6 md:pl-20 md:pr-6">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Soluções</h3>
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-5">
                    <div className="grid grid-cols-3 gap-6">
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
              </div>
              <div className="absolute inset-y-0 right-0 w-[40vw] border-l border-slate-100 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setDesktopOpen(false)}
                  className="absolute right-4 top-2 text-3xl font-semibold text-slate-500 transition hover:text-slate-700"
                  aria-label="Fechar"
                >
                  ×
                </button>
                <div className="mx-auto flex w-full max-w-6xl px-4 md:px-6">
                  <div className="w-full max-w-[320px] pt-6">
                    <div className="space-y-4 border-t border-slate-100 pl-4 pr-0 pt-4 pb-6">
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
            href="/knexit-workspace#contato"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border-[3px] border-white/80 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white no-underline transition-colors hover:border-slate-300 hover:bg-white hover:text-[#2F7E95] hover:no-underline lg:text-[14px]"
          >
            Fale com a equipe de vendas
          </Link>
          <Link
            href="/knexit-workspace/acesso"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#2F7E95] shadow-sm no-underline hover:bg-white/90 hover:no-underline lg:text-[14px]"
          >
            Iniciar agora
          </Link>
        </div>
      );
    }

    if (layout === "nav") {
      return (
        <div className="hidden md:flex w-full items-center gap-6 text-[13px] font-semibold text-white lg:gap-7 lg:text-[15px] xl:hidden">
          {solutionsTrigger}
          <nav className="flex items-center gap-6 lg:gap-7">
            {mainLinks.map((item) =>
              renderLink(item, "whitespace-nowrap text-white/90 no-underline hover:text-white hover:no-underline")
            )}
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
      <div className="hidden xl:flex w-full items-center gap-6 text-[13px] font-semibold text-white lg:text-[15px]">
        <div className="flex items-center gap-6 pl-12">
          {solutionsTrigger}
          <nav className="flex items-center gap-6 lg:gap-7">
            {mainLinks.map((item) =>
              renderLink(item, "whitespace-nowrap text-white/90 no-underline hover:text-white hover:no-underline")
            )}
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
            href="/knexit-workspace#contato"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border-[3px] border-white/80 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white no-underline transition-colors hover:border-slate-300 hover:bg-white hover:text-[#2F7E95] hover:no-underline lg:text-[14px]"
          >
            Fale com a equipe de vendas
          </Link>
          <Link
            href="/knexit-workspace/acesso"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#2F7E95] shadow-sm no-underline hover:bg-white/90 hover:no-underline lg:text-[14px]"
          >
            Iniciar agora
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
                href={`/branding/${product.slug}`}
                onClick={onNavigate}
                className="flex items-start gap-3 py-3 text-sm font-semibold leading-normal text-slate-900 no-underline hover:text-blue-600 hover:no-underline"
              >
                <img
                  src={`/knexit-workspace/product-icons/${product.icon ?? "doc"}.svg`}
                  alt={product.name}
                  width={28}
                  height={28}
                />
                <span>{product.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <div className="px-4 py-0">
        <div>
          {MENU_LINKS.filter((item) => item.label !== "Produtos").map((item) =>
            renderLink(
              item,
              `block py-3 text-sm font-semibold leading-normal no-underline hover:no-underline ${item.accent ? "text-blue-600" : "text-slate-900"}`
            )
          )}
        </div>
      </div>
      <div className="border-t border-slate-200/80 px-4 pt-5 pb-6">
        <div className="space-y-3">
          <Link
            href="/knexit-workspace#contato"
            onClick={onNavigate}
            className="flex w-full items-center justify-center rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold leading-normal text-blue-600 no-underline hover:bg-white hover:no-underline"
          >
            Fale com a equipe de vendas
          </Link>
          <Link
            href="/knexit-workspace/acesso"
            onClick={onNavigate}
            className="flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold leading-normal text-white no-underline hover:bg-blue-700 hover:no-underline"
          >
            Iniciar agora
          </Link>
        </div>
      </div>
    </div>
  );
}
