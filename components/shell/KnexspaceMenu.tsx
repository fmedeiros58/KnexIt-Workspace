"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

type KnexspaceMenuProps = {
  onNavigate?: () => void;
  variant?: "mobile" | "desktop";
  layout?: "full" | "actions" | "nav";
};

const MENU_LINKS = [
  { label: "Produtos", href: "/lobby" },
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
  variant = "mobile",
  layout = "full",
}: KnexspaceMenuProps) {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
          <div className="absolute left-0 top-full mt-4 w-[860px] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Soluções</h3>
              <button
                type="button"
                onClick={() => setDesktopOpen(false)}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-[2.4fr_1fr] gap-8 border-t border-slate-200 pt-5">
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
              <div className="space-y-4 border-l border-slate-200 pl-6">
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
        ) : null}
      </div>
    );

    if (layout === "actions") {
      return (
        <div className="hidden md:flex w-full items-center justify-end gap-6 text-[13px] font-semibold lg:gap-7 lg:text-[15px] xl:hidden">
          <Link
            href="/knexit-workspace#contato"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-slate-300 px-4 py-2 text-[12px] font-semibold text-blue-600 no-underline hover:bg-slate-50 hover:no-underline lg:text-[14px]"
          >
            Fale com a equipe de vendas
          </Link>
          <Link
            href="/knexit-workspace/acesso"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white no-underline hover:bg-blue-700 hover:no-underline lg:text-[14px]"
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
            {mainLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="whitespace-nowrap text-white/90 no-underline hover:text-white hover:no-underline"
              >
                {item.label}
              </Link>
            ))}
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
            {mainLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="whitespace-nowrap text-white/90 no-underline hover:text-white hover:no-underline"
              >
                {item.label}
              </Link>
            ))}
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
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-slate-300 px-4 py-2 text-[12px] font-semibold text-blue-600 no-underline hover:bg-slate-50 hover:no-underline lg:text-[14px]"
          >
            Fale com a equipe de vendas
          </Link>
          <Link
            href="/knexit-workspace/acesso"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white no-underline hover:bg-blue-700 hover:no-underline lg:text-[14px]"
          >
            Iniciar agora
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="rounded-2xl bg-slate-50 px-4 py-4">
        <div className="text-sm font-semibold text-slate-900">Soluções</div>
        <div className="mt-3 space-y-2">
          {SOLUTION_GROUPS.map((group) => {
            const isOpen = expandedGroup === group.title;
            return (
              <div key={group.title} className="rounded-xl bg-white px-3 py-2 shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedGroup(isOpen ? null : group.title)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900"
                >
                  {group.title}
                  <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen ? (
                  <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={onNavigate}
                        className="block text-sm text-slate-700 no-underline hover:text-blue-600 hover:no-underline"
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
        <div className="mt-4 space-y-2">
          {SOLUTION_SIDE.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 no-underline hover:bg-white hover:text-blue-600 hover:no-underline"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {MENU_LINKS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className={`block text-sm font-semibold no-underline hover:no-underline ${
              item.accent ? "text-blue-600" : "text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 border-t border-slate-200/80 pt-5">
        <div className="space-y-3">
          <Link
            href="/knexit-workspace#contato"
            onClick={onNavigate}
            className="flex w-full items-center justify-center rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold text-blue-600 no-underline hover:bg-white hover:no-underline"
          >
            Fale com a equipe de vendas
          </Link>
          <Link
            href="/knexit-workspace/acesso"
            onClick={onNavigate}
            className="flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white no-underline hover:bg-blue-700 hover:no-underline"
          >
            Iniciar agora
          </Link>
        </div>
      </div>
    </div>
  );
}
