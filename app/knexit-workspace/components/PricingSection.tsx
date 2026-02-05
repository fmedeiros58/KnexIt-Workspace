"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PLANS } from "./PlansSection";

type Plan = (typeof PLANS)[number];

type PricingCardProps = {
  plan: Plan;
  className?: string;
};

function PricingCard({ plan, className }: PricingCardProps) {
  const isEnterprise = plan.id === "enterprise";
  const isHighlighted = Boolean(plan.highlight);
  const buttonClasses = isHighlighted
    ? "bg-[#2F7BFF] text-white border border-transparent hover:bg-[#2567d6]"
    : "bg-white text-[#2F7BFF] border border-slate-300 hover:border-slate-400";

  return (
    <div
      className={`flex h-full w-full max-w-[360px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:max-w-none ${
        isHighlighted ? "ring-2 ring-[#2F7BFF]/70" : ""
      } ${className ?? ""}`}
    >
      <div className="text-center">
        {isHighlighted ? (
          <span className="mb-3 inline-flex items-center rounded-full bg-[#2F7BFF] px-2 py-1 text-xs font-semibold text-white">
            Mais popular
          </span>
        ) : null}
        <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
        <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
        <div className="mt-4 text-3xl font-bold text-slate-900">{plan.priceLabel}</div>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>mensais por usuario (contrato de um ano)</span>
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold">
            i
          </span>
        </div>
        <div className="mt-4">
          <button className={`w-full rounded-full px-4 py-2 text-sm font-semibold ${buttonClasses}`}>
            {isEnterprise ? "Fale com a equipe de vendas" : "Iniciar agora"}
          </button>
        </div>
      </div>

      <div className="mt-5 flex-1 border-t border-slate-200 pt-4">
        <ul className="space-y-3 text-sm text-slate-700">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-2">
              <span className="text-emerald-600">&bull;</span>
              <span>{feature}</span>
            </li>
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
          <h2 className="text-3xl font-bold text-slate-900">Planos e precos</h2>
          <p className="text-lg text-slate-600">
            Escolha o nivel de recursos, IA e colaboracao que faz sentido para sua realidade.
          </p>
        </div>

        <div className="xl:hidden">
          <div
            ref={scrollerRef}
            className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 scroll-px-4 sm:px-6 sm:scroll-px-6"
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
