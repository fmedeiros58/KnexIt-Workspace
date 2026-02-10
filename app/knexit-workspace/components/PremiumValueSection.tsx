"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  chat: {
    bg: "bg-teal-100",
    fg: "text-teal-700",
    path: <path fill="currentColor" d="M5 5h14v9H9l-4 4V5Zm2.5 3.5v1.5h9V8.5h-9Zm0 3v1.5h6V11.5h-6Z" />,
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
  kanban: {
    bg: "bg-emerald-100",
    fg: "text-emerald-700",
    path: <path fill="currentColor" d="M5 5h14v14H5V5Zm2 2.5v9h2v-9H7Zm4 0v4h2v-4h-2Zm4 0v6.5h2v-6.5h-2Z" />,
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
};

const CARD_ICON: Record<string, keyof typeof ICONS> = {
  KnexMail: "mail",
  KnexDrive: "supadrive",
  KnexChat: "chat",
  VioClass: "play",
  KnexAI: "owl",
  VioLive: "live",
  KnexAnalytics: "analytics",
  KnexFlow: "kanban",
};

export default function PremiumValueSection() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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
    <section id="premium" className="bg-[#E5F3F4] py-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
        <div className="flex flex-wrap items-center justify-center gap-4 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Uma assinatura com muito valor premium.</h2>
        </div>
      </div>

      <div className="relative mt-6">
        <button
          type="button"
          onClick={() => handleScroll("left")}
          className="absolute left-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white md:inline-flex"
          aria-label="Ver cards anteriores"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => handleScroll("right")}
          className="absolute right-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white md:inline-flex"
          aria-label="Ver próximos cards"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-2 scroll-px-4 max-lg:gap-0 max-lg:px-0 max-lg:scroll-px-0 lg:gap-5 lg:px-28 lg:scroll-px-28"
        >
          {VALUE_CARDS.map((card, index) => {
            const isActive = index === activeIndex;
            const isDesktopSelected = selectedIndex === index;
            return (
              <div
                key={card.title}
                data-card
                className="flex w-auto min-w-0 flex-none snap-start justify-center max-lg:w-full max-lg:min-w-full max-lg:snap-start"
              >
                <article
                  onMouseEnter={() => setSelectedIndex(index)}
                  onMouseLeave={() => setSelectedIndex(null)}
                  className={`group relative flex w-[min(78vw,320px)] min-w-[min(78vw,320px)] cursor-pointer flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50 transition sm:w-[min(72vw,420px)] sm:min-w-[min(72vw,420px)] md:w-[min(68vw,520px)] md:min-w-[min(68vw,520px)] lg:w-[min(28vw,380px)] lg:min-w-[min(28vw,380px)] aspect-[18/25] max-md:aspect-auto hover:border-[#2F7BFF] max-lg:hover:bg-[#2F7BFF] hover:shadow-lg ${
                    isActive ? "max-lg:border-[#2F7BFF] max-lg:bg-[#2F7BFF] max-lg:shadow-md" : ""
                  } ${isDesktopSelected ? "lg:border-[#2F7BFF] lg:shadow-md" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-1/2 top-0 hidden h-[320%] w-[320%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2F7BFF] opacity-0 transition-[transform,opacity] duration-500 ease-out lg:block ${
                      isDesktopSelected ? "lg:scale-100 lg:opacity-100" : "lg:scale-0 lg:opacity-0"
                    }`}
                  />
                  <div
                    className={`relative z-10 flex flex-none items-start justify-center bg-slate-50 px-1 pt-1 pb-2 transition-colors group-hover:bg-transparent ${
                      isActive ? "max-lg:bg-transparent" : ""
                    }`}
                  >
                    <div
                      className={`w-full aspect-[4/3] overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm transition group-hover:border-[#2F7BFF]/60 group-hover:shadow-md ${
                        isActive || isDesktopSelected ? "border-[#2F7BFF]/60 shadow-md" : ""
                      }`}
                    >
                      <Image
                        src={card.image}
                        alt={`Prévia ${card.badge}`}
                        width={640}
                        height={480}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  <div
                    className={`relative z-10 flex min-h-0 flex-[1.4] flex-col gap-2 bg-transparent px-5 pb-8 pt-3 text-slate-900 transition-colors max-lg:group-hover:text-white sm:gap-3 ${
                      isActive ? "max-lg:text-white" : ""
                    } ${isDesktopSelected ? "lg:text-white" : ""}`}
                  >
                    <span
                      className={`inline-flex w-fit items-center rounded-full bg-[#2F7BFF]/10 px-3 py-1 text-[clamp(0.65rem,0.9vw,0.75rem)] font-semibold text-[#2F7BFF] transition-colors max-lg:group-hover:bg-white max-lg:group-hover:text-[#2F7BFF] ${
                        isActive ? "max-lg:bg-white max-lg:text-[#2F7BFF]" : ""
                      } ${isDesktopSelected ? "lg:bg-white lg:text-[#2F7BFF]" : ""}`}
                    >
                      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80">
                        <svg viewBox="0 0 24 24" className={`h-3 w-3 ${ICONS[CARD_ICON[card.badge] ?? "mail"].fg}`} aria-hidden="true">
                          {ICONS[CARD_ICON[card.badge] ?? "mail"].path}
                        </svg>
                      </span>
                      {card.badge}
                    </span>
                    <h3 className="text-[clamp(0.95rem,1.25vw,1.15rem)] font-semibold leading-snug">
                      {card.title}
                    </h3>
                    <p
                      className={`text-[clamp(0.78rem,1vw,0.95rem)] leading-snug text-slate-600 transition-colors max-lg:group-hover:text-white/90 ${
                        isActive ? "max-lg:text-white/90" : ""
                      } ${isDesktopSelected ? "lg:text-white/90" : ""}`}
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
