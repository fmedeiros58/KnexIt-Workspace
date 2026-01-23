"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function randomCode() {
  const part = () => Math.random().toString(36).slice(2, 6);
  return `${part()}-${part()}-${part()}`;
}

function makeRoomLink() {
  const code = randomCode();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/violive/sala/${code}`;
}

function formatTimestamp(value: Date) {
  const time = value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = value
    .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
    .replace(".", "");
  return `${time} · ${date}`;
}

export default function VioLivePage() {
  const [tab, setTab] = useState<"reunioes" | "ligacoes">("reunioes");
  const [menuOpen, setMenuOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copyOpen, setCopyOpen] = useState(false);
  const [generated, setGenerated] = useState("");
  const [meetingCode, setMeetingCode] = useState("");
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    const update = () => setTimestamp(formatTimestamp(new Date()));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-apps]")) setAppsOpen(false);
      if (!target.closest("[data-profile]")) setProfileOpen(false);
      if (!target.closest("[data-menu]")) setMenuOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const canJoin = meetingCode.trim().length > 0;
  const sideWidth = sidebarOpen ? "w-56" : "w-0";

  function onNewMeeting(action: "link" | "instant" | "agenda") {
    if (action === "link") {
      const url = makeRoomLink();
      setGenerated(url);
      setMenuOpen(false);
      setCopyOpen(true);
      return;
    }
    if (action === "instant") {
      const url = makeRoomLink();
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = "/violive/agenda";
  }

  function joinMeeting() {
    if (!canJoin) return;
    const trimmed = meetingCode.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      window.location.href = trimmed;
      return;
    }
    window.location.href = `/violive/sala/${trimmed}`;
  }

  const navItems = useMemo(
    () => [
      { id: "reunioes" as const, label: "Reuniões", icon: IconCalendar },
      { id: "ligacoes" as const, label: "Ligações", icon: IconVideo },
    ],
    []
  );

  return (
    <div
      className="min-h-screen bg-[radial-gradient(900px_circle_at_top_left,_#e0f2fe_0,_#f8fafc_55%,_#ffffff_100%)] text-slate-900"
      style={{
        fontFamily: "'Sora', sans-serif",
        backgroundColor: "var(--vio-bg)",
      }}
    >
      <style jsx global>{`
        :root {
          --vio-bg: #f8fafc;
          --vio-ink: #0f172a;
          --vio-muted: #475569;
          --vio-primary: #2563eb;
          --vio-soft: #e2e8f0;
        }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setSidebarOpen((prev) => !prev)}
              data-sidebar-trigger
              aria-label="Abrir menu"
            >
              <IconHamburger className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <LogoVioLive className="h-8 w-8" />
              <span className="text-lg font-semibold tracking-tight">VioLive</span>
            </div>
          </div>

          <div className="hidden items-center gap-4 text-sm text-slate-600 md:flex">
            <span>{timestamp || "--:--"}</span>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="Ajuda"
            >
              <IconHelp className="h-5 w-5 text-slate-700" />
            </button>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="Configurações"
            >
              <IconSettings className="h-5 w-5 text-slate-700" />
            </button>
            <div className="relative" data-apps>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                onClick={() => setAppsOpen((prev) => !prev)}
                aria-label="Apps"
              >
                <IconDots className="h-4 w-4 text-slate-700" />
              </button>
              {appsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="grid grid-cols-3 gap-3">
                    {APPS.map((app) => (
                      <Link
                        key={app.title}
                        href={app.href}
                        className="group flex flex-col items-center gap-2 rounded-xl border border-transparent px-3 py-3 text-center text-xs text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                      >
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${app.bg}`}>
                          {app.icon}
                        </span>
                        <span className="text-slate-700 group-hover:text-slate-900">{app.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative" data-profile>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white"
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-label="Conta"
              >
                FM
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-xl">
                  <div className="px-4 py-3">
                    <p className="text-xs text-slate-500">Conectado como</p>
                    <p className="text-sm font-semibold text-slate-900">usuario@knexit.com</p>
                  </div>
                  <div className="border-t border-slate-200" />
                  <div className="px-2 py-2">
                    <Link href="/dashboard" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                      Minha área
                    </Link>
                    <Link href="/settings" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                      Configurações
                    </Link>
                    <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex w-full gap-8 px-4 py-10 md:px-6">
        <aside className={`shrink-0 overflow-hidden transition-all duration-300 ${sideWidth}`}>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-3xl flex-col">
            <div className="flex min-h-[calc(100vh-220px)] flex-col justify-center">
              <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                Videochamadas e reuniões para todos
              </h1>
              <p className="mt-3 text-base text-slate-600">
                Conecte-se, colabore e compartilhe ideias em qualquer lugar com o VioLive.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3" data-menu>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
                  >
                    <IconVideo className="h-5 w-5" />
                    Nova reunião
                  </button>

                  {menuOpen && (
                    <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl">
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

                <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
                  <IconKeyboard className="h-5 w-5 text-slate-400" />
                  <input
                    value={meetingCode}
                    onChange={(event) => setMeetingCode(event.target.value)}
                    className="flex-1 bg-transparent outline-none"
                    placeholder="Digite um código ou link"
                  />
                </div>

                <button
                  type="button"
                  onClick={joinMeeting}
                  disabled={!canJoin}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Participar
                </button>
              </div>
            </div>

            <div className="mt-10 border-t border-slate-200 pt-8">
              {tab === "reunioes" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                        <LogoVioLive className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          Recursos premium para reuniões maiores
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          Faça videochamadas com grupos maiores, use cancelamento de ruído e muito mais no plano
                          Knexit Pro.
                        </p>
                        <button className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700">
                          Conhecer o plano
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {UPCOMING.map((item, index) => (
                      <div
                        key={item.title}
                        className={`flex items-center gap-6 px-6 py-4 text-sm ${
                          index > 0 ? "border-t border-slate-200" : ""
                        }`}
                      >
                        <span className="w-24 text-slate-500">{item.when}</span>
                        <span className="font-medium text-slate-900">{item.title}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500">Na sua conta do Knexit Agenda: usuario@knexit.com</p>
                  <Link href="/violive" className="text-xs font-semibold text-blue-600">
                    Saiba mais sobre o VioLive
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Ligações</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Faça e receba ligações diretamente no VioLive (em breve).
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>

        <div className={`hidden shrink-0 transition-all duration-300 xl:block ${sideWidth}`} aria-hidden />
      </div>

      {copyOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="absolute inset-0" onClick={() => setCopyOpen(false)} aria-hidden />
          <div className="relative w-[420px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="pr-6">
                <h3 className="text-lg font-semibold text-slate-900">Veja como participar a seguir</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Envie este link para quem participar da reunião. Recomendamos salvá-lo para usar mais tarde.
                </p>
              </div>
              <button
                onClick={() => setCopyOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <IconClose className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <IconLink className="h-5 w-5 text-slate-400" />
              <input value={generated} readOnly className="flex-1 text-sm outline-none" />
              <button
                onClick={() => navigator.clipboard.writeText(generated)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                <IconCopy className="h-4 w-4" />
                Copiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </span>
      <span className="text-slate-800">{title}</span>
    </button>
  );
}

function LogoVioLive({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="vio" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="20" height="16" rx="5" fill="url(#vio)" />
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
const IconHelp = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.1 9a3 3 0 1 1 4.8 2.4c-.8.5-1.4 1.1-1.4 2v.6M12 17h.01" />
  </svg>
);
const IconSettings = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M19.4 12a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7.4 7.4 0 0 0 .1-1Z" />
  </svg>
);
const IconHamburger = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const UPCOMING = [
  { when: "Dia inteiro", title: "Encontros Medeiros" },
  { when: "Dia inteiro", title: "Gestão de Sistema Penitenciário e Direitos Humanos" },
];

const APPS = [
  { title: "VioLive", href: "/violive", bg: "bg-blue-50", icon: <LogoVioLive className="h-6 w-6" /> },
  { title: "Agenda", href: "/violive/agenda", bg: "bg-sky-50", icon: <IconCalendar className="h-5 w-5" /> },
  { title: "SupaDrive", href: "/supadrive", bg: "bg-amber-50", icon: <span className="text-sm font-semibold">SD</span> },
  { title: "VioClass", href: "/vioclass", bg: "bg-violet-50", icon: <span className="text-sm font-semibold">VC</span> },
  { title: "KnexAI", href: "/knexai", bg: "bg-emerald-50", icon: <span className="text-sm font-semibold">KA</span> },
  { title: "Workspace", href: "/knexit-workspace", bg: "bg-slate-100", icon: <span className="text-sm font-semibold">KW</span> },
];
