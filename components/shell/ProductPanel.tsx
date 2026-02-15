"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import {
  CATEGORY_LABEL,
  PRODUCT_PANEL_SIDE_LINKS,
  WORKSPACE_PRODUCTS,
} from "@/app/knexit-workspace/components/productsData";

type ProductPanelProps = {
  onClose: () => void;
};

export default function ProductPanel({ onClose }: ProductPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const categories = useMemo(() => {
    const order: Array<(typeof WORKSPACE_PRODUCTS)[number]["category"]> = [
      "video",
      "produtividade",
      "ia",
      "comunicacao",
      "infra",
    ];
    return order.filter((category) => WORKSPACE_PRODUCTS.some((p) => p.category === category));
  }, []);
  const iconSrcByType: Record<string, string> = {
    play: "/knexit-workspace/product-icons/play.svg",
    record: "/knexit-workspace/product-icons/record.svg",
    edit: "/knexit-workspace/product-icons/edit.svg",
    live: "/knexit-workspace/product-icons/live.svg",
    folder: "/knexit-workspace/product-icons/folder.svg",
    supadrive: "/knexit-workspace/product-icons/supadrive.svg",
    doc: "/knexit-workspace/product-icons/doc.svg",
    read: "/knexit-workspace/product-icons/read.svg",
    kanban: "/knexit-workspace/product-icons/kanban.svg",
    chat: "/knexit-workspace/product-icons/chat.svg",
    search: "/knexit-workspace/product-icons/search.svg",
    review: "/knexit-workspace/product-icons/review.svg",
    analytics: "/knexit-workspace/product-icons/analytics.svg",
    owl: "/knexit-workspace/product-icons/owl.svg",
    mail: "/knexit-workspace/product-icons/mail.svg",
    credit: "/knexit-workspace/product-icons/credit.svg",
    hub: "/knexit-workspace/product-icons/hub.svg",
  };
  const fallbackIconSrc = "/knexit-workspace/product-icons/doc.svg";

  useEffect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute left-0 right-0 top-full z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-200 bg-white shadow-xl md:overflow-visible"
      role="region"
      aria-label="Menu de produtos"
    >
      <div className="relative">
        <div
          className="pointer-events-none absolute right-0 top-0 hidden h-full md:block md:w-[clamp(0px,calc((100vw-72rem)/2),9999px)] bg-slate-100"
          aria-hidden
        />
        <button
          type="button"
          className="absolute right-4 top-2 text-3xl font-semibold text-slate-500 transition hover:text-slate-700"
          aria-label="Fechar menu de produtos"
          onClick={onClose}
        >
          ×
        </button>
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-[clamp(1.5rem,4vw,3rem)]">
          <div className="flex flex-col gap-6 border-t border-slate-200 pb-6 pt-6 md:flex-row md:items-start md:gap-8">
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:hidden">
                {WORKSPACE_PRODUCTS.map((product) => {
                  const iconSrc = product.icon ? iconSrcByType[product.icon] ?? fallbackIconSrc : fallbackIconSrc;
                  return (
                    <Link
                      key={product.slug}
                      href={`/landing-produtos/${product.slug}`}
                      onClick={onClose}
                      className="flex items-start gap-4 rounded-lg border border-transparent px-3 py-1.5 text-left no-underline transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--kx-focus)] focus-visible:ring-offset-2"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                        <Image
                          src={iconSrc}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 object-contain"
                        />
                      </div>
                      <p className="min-w-0 text-sm leading-snug text-slate-900">
                        <strong className="block text-sm font-semibold">{product.name}</strong>
                        <span className="block text-xs text-slate-500">{product.description}</span>
                      </p>
                    </Link>
                  );
                })}
              </div>
              <div className="hidden md:grid md:w-full md:grid-cols-2 lg:grid-cols-3 md:gap-x-6 md:gap-y-2">
                {WORKSPACE_PRODUCTS.map((product) => {
                  const iconSrc = product.icon ? iconSrcByType[product.icon] ?? fallbackIconSrc : fallbackIconSrc;
                  return (
                    <Link
                      key={product.slug}
                      href={`/landing-produtos/${product.slug}`}
                      onClick={onClose}
                      className="group flex items-start gap-4 rounded-lg border border-transparent px-3 py-1 text-left no-underline transition hover:bg-slate-50 hover:ring-1 hover:ring-inset hover:ring-[color:var(--kx-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--kx-focus)] focus-visible:ring-offset-2"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                        <Image
                          src={iconSrc}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 object-contain"
                        />
                      </div>
                      <p className="min-w-0 text-sm leading-snug text-slate-900">
                        <strong className="block text-sm font-semibold line-clamp-1">{product.name}</strong>
                        <span className="block text-xs text-slate-500 line-clamp-2">{product.description}</span>
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
            <details
              className="product-panel-links w-full bg-slate-100 md:-mb-6 md:-mt-6 md:w-[32%] md:max-w-[320px] md:self-stretch md:pb-6 md:pt-6 md:pr-[clamp(1.5rem,4vw,3rem)] md:-mr-[clamp(1.5rem,4vw,3rem)] md:border-t"
              open
            >
              <summary className="sr-only">Links rápidos</summary>
              <aside className="w-full border-t border-slate-100 pt-6 text-sm md:h-full md:border-t-0 md:border-l md:pl-6">
                <div className="space-y-4">
                  {PRODUCT_PANEL_SIDE_LINKS.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onClose}
                      className="block font-semibold text-slate-900 transition hover:text-[var(--kx-primary)] no-underline"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </aside>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
