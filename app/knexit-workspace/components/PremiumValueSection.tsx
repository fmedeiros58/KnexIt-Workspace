"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const VALUE_CARDS = [
  {
    badge: "KnexMail",
    title: "Transmita uma imagem profissional com e-mail personalizado",
    description:
      "Destaque-se com um e-mail profissional com o domínio da sua empresa. Crie layouts com marca e personalize mensagens em escala.",
    image: "/knexit-workspace/placeholders/knexmail.svg",
  },
  {
    badge: "KnexDrive",
    title: "Arquivos organizados com segurança e controle de acesso",
    description:
      "Centralize documentos, controles e permissões em pastas inteligentes com versionamento e compartilhamento auditável.",
    image: "/knexit-workspace/placeholders/knexdrive.svg",
  },
  {
    badge: "KnexChat",
    title: "Conversas que viram decisões rápidas",
    description:
      "Chats, avisos e tarefas conectados em um único fluxo para reduzir ruído e acelerar alinhamentos de equipe.",
    image: "/knexit-workspace/placeholders/knexchat.svg",
  },
  {
    badge: "VioClass",
    title: "Aulas e trilhas com dados de engajamento",
    description:
      "Publique aulas, acompanhe progresso e personalize jornadas com insights em tempo real para cada turma.",
    image: "/knexit-workspace/placeholders/vioclass.svg",
  },
  {
    badge: "KnexAI",
    title: "IA aplicada à revisão, busca e síntese",
    description:
      "Automatize revisões, traduções e pesquisas com assistência inteligente integrada ao conteúdo.",
    image: "/knexit-workspace/placeholders/knexai.svg",
  },
  {
    badge: "VioLive",
    title: "Lives com qualidade e presença em tempo real",
    description:
      "Transmita encontros ao vivo com estabilidade, chat integrado e gravação automática para assistir depois.",
    image: "/knexit-workspace/placeholders/violive.svg",
  },
  {
    badge: "KnexAnalytics",
    title: "Métricas que orientam decisões inteligentes",
    description:
      "Dashboards claros para acompanhar desempenho, participação e evolução dos alunos em poucos cliques.",
    image: "/knexit-workspace/placeholders/knexanalytics.svg",
  },
  {
    badge: "KnexFlow",
    title: "Fluxos e tarefas organizados em um só lugar",
    description:
      "Distribua tarefas, acompanhe etapas e mantenha o time alinhado com automações e checklists.",
    image: "/knexit-workspace/placeholders/knexflow.svg",
  },
];

export default function PremiumValueSection() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (direction: "left" | "right") => {
    const node = scrollerRef.current;
    if (!node) return;
    const amount = Math.round(node.clientWidth * 0.8);
    node.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

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
    <section className="bg-[#E5F3F4] py-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl font-bold text-slate-900">Uma assinatura com muito valor premium.</h2>
        </div>
      </div>

      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => handleScroll("left")}
          className="absolute left-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white md:inline-flex"
          aria-label="Ver cards anteriores"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => handleScroll("right")}
          className="absolute right-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white md:inline-flex"
          aria-label="Ver próximos cards"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-2 scroll-px-4 max-lg:gap-0 max-lg:px-0 max-lg:scroll-px-0 lg:gap-5 lg:px-6 lg:scroll-px-6"
        >
          {VALUE_CARDS.map((card, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={card.title}
                data-card
                className="flex w-auto min-w-0 flex-none snap-start justify-center max-lg:w-full max-lg:min-w-full max-lg:snap-start"
              >
                <article
                  className={`group flex w-[min(80vw,320px)] min-w-[min(80vw,320px)] flex-col overflow-hidden rounded-[20px] border border-[#2F7BFF]/30 bg-white shadow-sm transition sm:w-[min(75vw,420px)] sm:min-w-[min(75vw,420px)] md:w-[min(70vw,520px)] md:min-w-[min(70vw,520px)] lg:w-[min(28vw,380px)] lg:min-w-[min(28vw,380px)] aspect-[3/5] hover:border-[#2F7BFF] hover:bg-[#2B6D7C] hover:shadow-md ${
                    isActive ? "max-lg:border-[#2F7BFF] max-lg:bg-[#2B6D7C] max-lg:shadow-md" : ""
                  }`}
                >
                  <div
                    className={`relative flex flex-[3] items-start justify-center bg-white/70 px-2 pt-2 pb-3 transition-colors group-hover:bg-transparent ${
                      isActive ? "max-lg:bg-transparent" : ""
                    }`}
                  >
                    <div
                    className={`h-full w-full max-h-[260px] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition group-hover:border-[#2F7BFF]/60 group-hover:shadow-md ${
                      isActive ? "border-[#2F7BFF]/60 shadow-md" : ""
                    }`}
                    >
                      <img
                        src={card.image}
                        alt={`Prévia ${card.badge}`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <div
                  className={`flex flex-[2] flex-col space-y-3 bg-transparent px-5 pb-8 pt-3 text-slate-900 transition-colors group-hover:text-white ${
                    isActive ? "max-lg:text-white" : ""
                  }`}
                >
                  <span
                    className={`inline-flex w-fit items-center rounded-full bg-[#2F7BFF]/10 px-3 py-1 text-xs font-semibold text-[#2F7BFF] transition-colors group-hover:bg-white/15 group-hover:text-white ${
                      isActive ? "max-lg:bg-white/15 max-lg:text-white" : ""
                    }`}
                  >
                    {card.badge}
                  </span>
                  <h3 className="text-lg font-semibold leading-snug">{card.title}</h3>
                  <p
                    className={`text-sm text-slate-600 transition-colors group-hover:text-white/90 ${
                      isActive ? "max-lg:text-white/90" : ""
                    }`}
                  >
                      {card.description}
                    </p>
                  </div>
                </article>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 lg:hidden">
          {VALUE_CARDS.map((card, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => scrollToIndex(index)}
                className={`h-2 w-2 rounded-full transition ${
                  isActive ? "bg-[#2F7BFF]" : "bg-slate-300"
                }`}
                aria-label={`Ir para o slide ${index + 1}`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
