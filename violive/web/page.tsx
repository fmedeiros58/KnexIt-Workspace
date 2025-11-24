"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

/* ===========================
   Utils simples
=========================== */
function randomCode() {
  const part = () => Math.random().toString(36).slice(2, 6);
  return `${part()}-${part()}-${part()}`;
}
function makeRoomLink() {
  const code = randomCode();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/VioLive/sala/${code}`;
}

/* ===========================
   Página
=========================== */
export default function VioLivePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [generated, setGenerated] = useState<string>("");

  const [appsOpen, setAppsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // sanduíche do topo
  const [topMenuOpen, setTopMenuOpen] = useState(false);

  // tabs da página
  const [tab, setTab] = useState<"reunioes" | "ligacoes">("reunioes");

  // fechar popovers ao clicar fora (exceto o modal de copiar)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-apps]")) setAppsOpen(false);
      if (!t.closest("[data-profile]")) setProfileOpen(false);
      if (!t.closest("[data-feedback]")) setFeedbackOpen(false);
      if (!t.closest("[data-menu]")) setMenuOpen(false);
      if (!t.closest("[data-topmenu]")) setTopMenuOpen(false);
      // ⚠️ não feche copyOpen aqui, para não sumir antes de montar
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  function onNewMeeting(action: "link" | "instant" | "agenda") {
    if (action === "link") {
      const url = makeRoomLink();
      setGenerated(url);
      setMenuOpen(false);
      setCopyOpen(true); // abre o modal de cópia
    } else if (action === "instant") {
      const url = makeRoomLink();
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = "/VioLive/agenda";
    }
  }

  function goTo(target: "reunioes" | "ligacoes") {
    setTab(target);
    setTopMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ===== TOPO FIXO: hambúrguer (margem esquerda) + logo + nome ===== */}
      <div className="fixed inset-x-0 top-0 z-[75] pointer-events-none">
        <div className="pl-4 pr-4 pt-4 flex items-center gap-3">
          {/* Sanduíche na margem (muda cor quando aberto) */}
          <div className="relative pointer-events-auto" data-topmenu>
            <button
              onClick={() => setTopMenuOpen((s) => !s)}
              className={[
                "inline-flex items-center justify-center h-9 w-9 rounded-lg ring-1 shadow transition-colors",
                topMenuOpen
                  ? "bg-slate-900 text-white ring-slate-800"
                  : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50",
              ].join(" ")}
              aria-label="Menu"
              title="Menu"
            >
              <IconHamburger className="h-5 w-5" />
            </button>

            {topMenuOpen && (
              <div className="absolute left-0 mt-2 w-48 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden">
                <button
                  onClick={() => goTo("reunioes")}
                  className={[
                    "w-full flex items-center gap-2 px-4 py-3 text-sm",
                    tab === "reunioes" ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <IconCalendar className="h-5 w-5" />
                  Reuniões
                </button>
                <div className="border-t border-slate-200" />
                <button
                  onClick={() => goTo("ligacoes")}
                  className={[
                    "w-full flex items-center gap-2 px-4 py-3 text-sm",
                    tab === "ligacoes" ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <IconVideo className="h-5 w-5" />
                  Ligações
                </button>
              </div>
            )}
          </div>

          {/* Logo */}
          <LogoVioLive className="h-10 w-10 shrink-0 pointer-events-auto" />

          {/* Nome/Título com “UP” vermelho vivo */}
          <div className="pointer-events-auto leading-tight select-none">
            <div className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
              <span className="text-red-600">UP</span>Conect
            </div>
            <div className="text-[12px] text-slate-500 -mt-0.5">
              Videoconferências e reuniões para todos
            </div>
          </div>
        </div>
      </div>

      {/* ===== Conteúdo hero ===== */}
      <section className="mx-auto max-w-4xl px-6 pt-20">
        {/* ↑ espaço para não ficar sob o topo fixo */}
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
            Conecte-se, colabore e comemore em qualquer lugar com o VioLive
          </h2>

          {/* ações */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="relative" data-menu>
              <button
                onClick={() => setMenuOpen((s) => !s)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 font-semibold shadow"
              >
                <IconPlus className="h-5 w-5" />
                Nova reunião
              </button>

              {menuOpen && (
                <div className="absolute left-0 mt-2 w-[280px] rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl overflow-hidden text-left">
                  <MenuItem
                    icon={<IconLink className="h-5 w-5" />}
                    title="Criar uma reunião para depois"
                    onClick={() => onNewMeeting("link")}
                  />
                  <MenuItem
                    icon={<IconPlus className="h-5 w-5" />}
                    title="Iniciar uma reunião instantânea"
                    onClick={() => onNewMeeting("instant")}
                  />
                  <MenuItem
                    icon={<IconCalendar className="h-5 w-5" />}
                    title="Agendar no VioLive Agenda"
                    onClick={() => onNewMeeting("agenda")}
                  />
                </div>
              )}
            </div>

            {/* input para código */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl ring-1 ring-slate-200 px-3 py-2 w-[320px]">
                <IconKeyboard className="h-5 w-5 text-slate-400" />
                <input
                  className="w-full outline-none text-[15px]"
                  placeholder="Digite um código ou link"
                />
              </div>
              {/* AJUSTE: botão Participar com cor/estados interativos */}
              <button
                className="cursor-pointer rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white px-4 py-2.5 font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
              >
                Participar
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Conteúdo por aba ===== */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        {tab === "reunioes" ? (
          <EmptyCard
            title="Sem reuniões agendadas para hoje"
            desc="Crie um link de reunião, inicie instantaneamente ou agende para mais tarde."
          />
        ) : (
          <EmptyCard
            title="Ligações"
            desc="Faça e receba ligações diretamente no VioLive (em breve)."
          />
        )}
      </section>

      {/* ===== Popover: copiar link ===== */}
      {copyOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/30">
          {/* clique no backdrop fecha */}
          <div
            className="absolute inset-0"
            onClick={() => setCopyOpen(false)}
            aria-hidden
          />
          <div className="relative w-[420px] max-w-[90vw] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between">
              <div className="pr-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  Veja como participar a seguir
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Envie este link para quem participará da reunião. Recomendamos
                  salvá-lo para usar mais tarde.
                </p>
              </div>
              <button
                onClick={() => setCopyOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
                aria-label="Fechar"
              >
                <IconClose className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl ring-1 ring-slate-200 px-3 py-2">
              <IconLink className="h-5 w-5 text-slate-400" />
              <input
                value={generated}
                readOnly
                className="flex-1 text-[15px] outline-none"
              />
              {/* AJUSTE: botão Copiar com cor/estados interativos */}
              <button
                onClick={() => navigator.clipboard.writeText(generated)}
                className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white px-3 py-1.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
              >
                <IconCopy className="h-4 w-4" />
                Copiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Dock flutuante direita ===== */}
      <div className="fixed right-4 top-4 z-[70] flex items-center gap-2">
        {/* Perfil */}
        <div className="relative" data-profile>
          <button
            onClick={() => setProfileOpen((s) => !s)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 shadow"
            title="Conta"
            aria-label="Conta"
          >
            <span className="font-bold text-slate-800">U</span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden">
              <div className="p-3">
                <p className="text-sm text-slate-500">Conectado como</p>
                <p className="text-sm font-medium text-slate-900 truncate">
                  usuario@knexit.com
                </p>
              </div>
              <div className="border-t border-slate-200" />
              <div className="p-2">
                <Link
                  href="/dashboard"
                  className="block rounded-lg px-3 py-2 text-sm no-underline hover:bg-slate-50"
                >
                  Minha área
                </Link>
                <Link
                  href="/settings"
                  className="block rounded-lg px-3 py-2 text-sm no-underline hover:bg-slate-50"
                >
                  Configurações
                </Link>
                <button className="w-full text-left rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>

        {/* App Launcher */}
        <div className="relative" data-apps>
          <button
            onClick={() => setAppsOpen((s) => !s)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow hover:bg-indigo-500"
            title="Apps"
            aria-label="Apps"
          >
            <IconDots className="h-5 w-5" />
          </button>
          {appsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white ring-1 ring-indigo-100 shadow-2xl p-3">
              <div className="grid grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {APPS.map((a) =>
                  a.external ? (
                    <a
                      key={a.title}
                      href={a.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group rounded-xl border border-transparent hover:border-slate-200 hover:bg-white p-3 flex flex-col items-center gap-2 no-underline"
                    >
                      <span
                        className={[
                          "inline-flex h-11 w-11 items-center justify-center rounded-xl shadow-sm",
                          a.bg,
                        ].join(" ")}
                      >
                        {a.icon}
                      </span>
                      <span className="text-[13px] text-slate-800 group-hover:text-slate-900 text-center">
                        {a.title}
                      </span>
                    </a>
                  ) : (
                    <Link
                      key={a.title}
                      href={a.href}
                      className="group rounded-xl border border-transparent hover:border-slate-200 hover:bg-white p-3 flex flex-col items-center gap-2 no-underline"
                    >
                      <span
                        className={[
                          "inline-flex h-11 w-11 items-center justify-center rounded-xl shadow-sm",
                          a.bg,
                        ].join(" ")}
                      >
                        {a.icon}
                      </span>
                      <span className="text-[13px] text-slate-800 group-hover:text-slate-900 text-center">
                        {a.title}
                      </span>
                    </Link>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Feedback */}
        <div className="relative" data-feedback>
          <button
            onClick={() => setFeedbackOpen((s) => !s)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 shadow hover:bg-slate-50"
            title="Enviar feedback"
            aria-label="Enviar feedback"
          >
            <IconMessage className="h-5 w-5 text-slate-800" />
          </button>
          {feedbackOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden">
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <IconBug className="h-5 w-5 text-rose-600" />
                <div>
                  <div className="text-sm font-medium">Informar um problema</div>
                  <div className="text-xs text-slate-500">
                    Conte o que não funcionou como esperado.
                  </div>
                </div>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <IconLight className="h-5 w-5 text-amber-500" />
                <div>
                  <div className="text-sm font-medium">Fazer uma sugestão</div>
                  <div className="text-xs text-slate-500">
                    Envie uma ideia para melhorarmos o VioLive.
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Suporte */}
        <Link
          href="/suporte"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 shadow hover:bg-slate-50"
          title="Suporte"
          aria-label="Suporte"
        >
          <IconHelp className="h-5 w-5 text-slate-800" />
        </Link>
      </div>
    </div>
  );
}

/* ===========================
   Componentes auxiliares
=========================== */
function MenuItem({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
        {icon}
      </span>
      <span className="text-[15px] text-slate-800">{title}</span>
    </button>
  );
}

function EmptyCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-none ring-1 ring-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto h-16 w-16">
        <LogoVioLive className="h-16 w-16 mx-auto" />
      </div>
      <h3 className="mt-3 text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-slate-600">{desc}</p>
    </div>
  );
}

/* ===========================
   Ícones (SVG inline)
=========================== */
function LogoVioLive({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="upcx" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="20" height="16" rx="5" fill="url(#upcx)" />
      <path d="M17 9l3-2v10l-3-2z" fill="#fff" opacity=".95" />
      <circle cx="10.5" cy="12" r="3.8" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="10.5" cy="12" r="1.2" fill="#fff" />
    </svg>
  );
}
const IconPlus = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconLink = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13" />
    <path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11" />
  </svg>
);
const IconCalendar = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);
const IconKeyboard = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
  </svg>
);
const IconClose = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const IconCopy = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <rect x="2" y="2" width="13" height="13" rx="2" />
  </svg>
);
const IconVideo = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <rect x="3" y="7" width="13" height="10" rx="2" />
    <path d="M16 9l5-3v12l-5-3z" />
  </svg>
);
const IconDots = (p: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <g transform="translate(2 2)">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => <circle key={`${r}-${c}`} cx={c * 8 + 2} cy={r * 8 + 2} r="1.6" />)
      )}
    </g>
  </svg>
);
const IconMessage = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);
const IconBug = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <rect x="7" y="8" width="10" height="10" rx="5" />
    <path d="M3 13h4M17 13h4M7 5l2 2M17 5l-2 2M12 2v3" />
  </svg>
);
const IconLight = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path d="M12 3a7 7 0 0 1 7 7c0 2.3-1.2 4.3-3 5.5V18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5C6.2 14.3 5 12.3 5 10a7 7 0 0 1 7-7Z" />
  </svg>
);
const IconHelp = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.1 9a3 3 0 1 1 4.8 2.4c-.8.5-1.4 1.1-1.4 2v.6M12 17h.01" />
  </svg>
);
const IconHamburger = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

/* ===========================
   Apps do Launcher
=========================== */
const APPS = [
  { title: "VioLive", href: "/VioLive", bg: "bg-white", icon: <LogoVioLive className="h-6 w-6" /> },
  // ⬇️ link correto da Agenda
  { title: "Agenda", href: "/VioLive/agenda", bg: "bg-blue-100", icon: <IconCalendar className="h-5 w-5" /> },
  { title: "Cursos", href: "/courses", bg: "bg-violet-100", icon: <span className="text-[15px]">🎓</span> },
  { title: "Questões", href: "/questions", bg: "bg-pink-100", icon: <span className="text-[15px]">🧩</span> },
  { title: "Aprovados", href: "/aprovados", bg: "bg-lime-100", icon: <span className="text-[15px]">🏆</span> },
  { title: "Planos", href: "/pricing", bg: "bg-rose-100", icon: <span className="text-[15px]">💳</span> },
  { title: "YouTube", href: "https://www.youtube.com/", external: true, bg: "bg-rose-100", icon: <span className="text-[16px]">▶️</span> },
  { title: "Gmail", href: "https://mail.google.com/", external: true, bg: "bg-orange-100", icon: <span className="text-[16px]">✉️</span> },
  { title: "SupaDrive", href: "/supadrive", bg: "bg-yellow-100", icon: <span className="text-[16px]">📁</span> },
];


