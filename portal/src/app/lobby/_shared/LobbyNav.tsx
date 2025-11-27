"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProductBaseUrl } from "../../../../lib/productBase";

type LobbyNavProps = {
  productSlug: string;
  productName: string;
  testLabel?: string;
  loginHref?: string;
};

const PRODUCT_GRID = [
  { name: "VioClass", slug: "vioclass", description: "Cursos e trilhas de aulas em video." },
  { name: "VioLive", slug: "violive", description: "Aulas e mentorias ao vivo." },
  { name: "SupaDrive", slug: "supadrive", description: "Armazenamento de arquivos." },
  { name: "VioRead", slug: "vioread", description: "Leitura assistida de PDFs e artigos." },
  { name: "KnexAI", slug: "knexai", description: "Camada unificada de IA." },
  { name: "KnexMail", slug: "knexmail", description: "E-mails e campanhas." },
  { name: "KnexDocs", slug: "knexdocs", description: "Documentos colaborativos." },
  { name: "KnexFlow", slug: "knexflow", description: "Automacao e orquestracao." },
  { name: "KnexSearch", slug: "knexsearch", description: "Busca unificada." },
  { name: "KnexChat", slug: "knexchat", description: "Chat e mensagens." },
  { name: "KnexReview", slug: "knexreview", description: "Revisao sistematica." },
  { name: "KnexPay", slug: "knexpay", description: "Cobranca e pagamentos." },
];

export default function LobbyNav({ productSlug, productName, testLabel, loginHref }: LobbyNavProps) {
  const [openMenu, setOpenMenu] = useState<"produtos" | null>(null);
  const [appBase] = useState(() => getProductBaseUrl(productSlug));
  const productPath = `/${productSlug}`;
  const defaultFrom = appBase ? `${appBase}${productPath}` : productPath;
  const loginLink = loginHref ?? `/login?product=${encodeURIComponent(productSlug)}&from=${encodeURIComponent(defaultFrom)}`;

  useEffect(() => {
    console.log(`LobbyNav (${productSlug}) loginLink:`, loginLink);
  }, [loginLink, productSlug]);

  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="flex w-full items-center px-4 py-3 md:px-6">
        <div className="flex items-center gap-6 flex-shrink-0">
          <Link href="/knexit-workspace" className="text-xl font-bold text-blue-700">
            KnexIT Workspace
          </Link>
        </div>
        <div className="hidden md:flex flex-1 items-center gap-6 text-sm font-semibold text-slate-700 pl-6">
          <Link href="/branding" className="hover:text-indigo-600">
            Solucoes
          </Link>
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setOpenMenu("produtos")}
              onMouseLeave={() => setOpenMenu(null)}
              className="flex items-center gap-1 hover:text-indigo-600"
            >
              Produtos
              <span aria-hidden className="text-xs">v</span>
            </button>
            {openMenu === "produtos" ? (
              <div
                className="absolute left-0 top-full mt-2 w-[70vw] max-w-4xl border border-slate-200 bg-white shadow-lg rounded-2xl"
                onMouseEnter={() => setOpenMenu("produtos")}
                onMouseLeave={() => setOpenMenu(null)}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  {PRODUCT_GRID.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/lobby/${p.slug}`}
                      className="rounded-xl border border-slate-200 bg-white p-4 hover:-translate-y-0.5 hover:shadow-md transition"
                    >
                      <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-600 mt-1">{p.description}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <Link href="/branding" className="hover:text-indigo-600">
            Setores
          </Link>
          <Link href="/branding/knexai" className="hover:text-indigo-600">
            IA
          </Link>
          <Link href="/knexit-workspace#planos" className="hover:text-indigo-600" target="_blank">
            Precos
          </Link>
          <Link href="/branding" className="hover:text-indigo-600">
            Recursos
          </Link>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3 ml-auto">
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

      {/* dropdown moved to button hover area above */}
    </div>
  );
}

