"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PLANS } from "./PlansSection";

type Plan = (typeof PLANS)[number];
type FeatureIcon = Plan["features"][number]["icon"];
type PlanFeature = Plan["features"][number];

const FEATURE_ICON_COLORS: Record<FeatureIcon, string> = {
  drive: "text-emerald-600",
  mail: "text-rose-600",
  spark: "text-amber-500",
  search: "text-indigo-600",
  video: "text-sky-600",
  calendar: "text-blue-600",
  doc: "text-slate-600",
  check: "text-blue-600",
};

const FEATURE_ICONS: Record<FeatureIcon, JSX.Element> = {
  drive: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M7 4h10l4 7-4 7H7L3 11 7 4Z"
        fill="currentColor"
      />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 7.5 12 13l8-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 2l2.6 6.5L22 11l-7.4 2.5L12 21l-2.6-7.5L2 11l7.4-2.5L12 2Z"
        fill="currentColor"
      />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16.2 16.2 21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <rect x="3" y="7" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 10.5 21 8v8l-5-2.5v-3Z" fill="currentColor" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 9h16" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <path d="M7 4h7l4 4v12H7V4Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <path d="M6 12.5 10.5 17 18 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function FeatureItem({ icon, title, detail }: PlanFeature) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center ${FEATURE_ICON_COLORS[icon]}`}>
        {FEATURE_ICONS[icon]}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
      </div>
    </li>
  );
}

type PricingCardProps = {
  plan: Plan;
  className?: string;
};

function PricingCard({ plan, className }: PricingCardProps) {
  const isHighlighted = Boolean(plan.highlight);
  const buttonClasses = isHighlighted
    ? "bg-[#2F7BFF] text-white border border-transparent hover:bg-[#2567d6]"
    : "bg-white text-[#2F7BFF] border border-slate-300 hover:border-slate-400";

  return (
    <div
      className={`flex h-full w-full max-w-[360px] flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:max-w-none ${
        isHighlighted ? "ring-2 ring-[#2F7BFF]/70" : ""
      } ${className ?? ""}`}
    >
      <div className="text-center">
        {plan.badge ? (
          <span className="mb-3 inline-flex items-center rounded-full bg-[#2F7BFF] px-2 py-1 text-xs font-semibold text-white">
            {plan.badge}
          </span>
        ) : null}
        <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
        {plan.price ? (
          <>
            <div className="mt-4 flex items-end justify-center gap-2">
              <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
              <span className="mb-1 text-xs font-semibold text-slate-500">{plan.priceUnit ?? "BRL"}</span>
            </div>
            {plan.oldPrice ? <div className="mt-1 text-sm text-slate-400 line-through">{plan.oldPrice}</div> : null}
            {plan.priceNote ? (
              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
                <span className="text-center leading-snug">
                  {plan.priceNote.map((line, index) => (
                    <span key={`${plan.id}-note-${index}`} className="block">
                      {line}
                    </span>
                  ))}
                </span>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold">
                  i
                </span>
              </div>
            ) : null}
          </>
        ) : plan.description ? (
          <p className="mt-4 text-sm font-semibold text-slate-700">{plan.description}</p>
        ) : null}
        <div className="mt-4">
          <button className={`w-full rounded-full px-4 py-2 text-sm font-semibold ${buttonClasses}`}>
            {plan.ctaLabel}
          </button>
        </div>
      </div>

      <div className="mt-5 flex-1 border-t border-slate-200 pt-4">
        <ul className="space-y-4">
          {plan.features.map((feature, index) => (
            <FeatureItem key={`${plan.id}-${index}`} {...feature} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PricingSection() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActiveIndex = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const cards = Array.from(node.querySelectorAll<HTMLElement>("[data-card]"));
    if (cards.length === 0) return;
    const containerRect = node.getBoundingClientRect();
    const center = containerRect.left + containerRect.width / 2;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(center - cardCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    setActiveIndex(bestIndex);
  }, []);

  const scrollToIndex = (index: number) => {
    const node = scrollerRef.current;
    if (!node) return;
    const cards = Array.from(node.querySelectorAll<HTMLElement>("[data-card]"));
    const target = cards[index];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActiveIndex);
    };
    updateActiveIndex();
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [updateActiveIndex]);

  return (
    <section id="precos" className="bg-[#E5F3F4] py-14">
      <div className="mx-auto max-w-6xl space-y-10 px-4 md:px-6">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Planos e preços</h2>
          <p className="text-lg text-slate-600">
            Escolha o nível de recursos, IA e colaboração que faz sentido para sua realidade.
          </p>
        </div>

        <div className="xl:hidden">
          <div
            ref={scrollerRef}
            className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto overflow-y-visible px-4 pb-4 pt-2 scroll-px-4 sm:px-6 sm:scroll-px-6"
          >
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                data-card
                className="flex w-full min-w-full flex-none snap-start justify-center md:w-[calc(50%-12px)] md:min-w-[calc(50%-12px)]"
              >
                <PricingCard plan={plan} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            {PLANS.map((plan, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => scrollToIndex(index)}
                  className={`h-2 w-2 rounded-full transition ${isActive ? "bg-[#2F7BFF]" : "bg-slate-300"}`}
                  aria-label={`Ir para o plano ${plan.name}`}
                />
              );
            })}
          </div>
        </div>

        <div className="hidden xl:grid grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <PricingCard key={plan.id} plan={plan} className="max-w-none" />
          ))}
        </div>
      </div>
    </section>
  );
}
