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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackView, setFeedbackView] = useState<"root" | "issue">("root");
  const [micOpen, setMicOpen] = useState(false);
  const [speakerOpen, setSpeakerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"audio" | "video" | "historico" | "gerais">("audio");
  const [historyScheduleOpen, setHistoryScheduleOpen] = useState(false);
  const [historySchedule, setHistorySchedule] = useState("Nunca");
  const [issueTopicOpen, setIssueTopicOpen] = useState(false);
  const [issueTopic, setIssueTopic] = useState("Escolha uma opção");
  const [diagEnabled, setDiagEnabled] = useState(true);
  const [workspaceNotifications, setWorkspaceNotifications] = useState(false);
  const [exitEmptyCalls, setExitEmptyCalls] = useState(true);
  const [onlyContacts, setOnlyContacts] = useState(false);
  const [selectedMic, setSelectedMic] = useState("Microfone (Logi Webcam C920e)");
  const [selectedSpeaker, setSelectedSpeaker] = useState("DELL S3422DWG (NVIDIA High Definition)");
  const [selectedCamera, setSelectedCamera] = useState("Logi Webcam C920e");
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
      if (!target.closest("[data-mic]")) setMicOpen(false);
      if (!target.closest("[data-speaker]")) setSpeakerOpen(false);
      if (!target.closest("[data-camera]")) setCameraOpen(false);
      if (!target.closest("[data-history-schedule]")) setHistoryScheduleOpen(false);
      if (!target.closest("[data-issue-topic]")) setIssueTopicOpen(false);
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
        fontFamily: "Arial, Helvetica, sans-serif",
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
              className="inline-flex h-[35px] w-[35px] items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="Ajuda"
            >
              <IconHelp className="h-[35px] w-[35px] text-black" />
            </button>
            <button
              className="inline-flex h-[35px] w-[35px] items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="Feedback"
              onClick={() => setFeedbackOpen(true)}
            >
              <IconChat className="h-[35px] w-[35px] text-black" />
            </button>
            <button
              className="inline-flex h-[35px] w-[35px] items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="Configurações"
              onClick={() => setSettingsOpen(true)}
            >
              <IconSettings className="h-[35px] w-[35px] text-black" />
            </button>
            <div className="relative" data-apps>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                onClick={() => setAppsOpen((prev) => !prev)}
                aria-label="Apps"
              >
                <IconDots className="h-[25px] w-[25px] text-black" />
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

      <div className={`flex w-full ${sidebarOpen ? "gap-8" : "gap-0"} px-4 py-6 md:px-6`}>
        <aside
          className={`shrink-0 overflow-hidden transition-all duration-300 ${
            sidebarOpen ? "w-56 opacity-100" : "w-0 opacity-0 pointer-events-none"
          }`}
        >
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <NavItem
                  key={item.id}
                  label={item.label}
                  selected={isActive}
                  icon={<Icon className="h-5 w-5" />}
                  onClick={() => setTab(item.id)}
                />
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-3xl flex-col">
            <div className="flex flex-col justify-center text-center">
              <h1 className="text-[2.4rem] font-semibold text-slate-900 md:text-[3.1rem] font-[family:Arial,Helvetica,sans-serif]">
                Videochamadas e reuniões para todos
              </h1>
              <p className="mt-3 text-[1.3rem] leading-[1.5] text-slate-600 font-[family:Arial,Helvetica,sans-serif]">
                Conecte-se, colabore e compartilhe ideias em qualquer lugar com o VioLive.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3" data-menu>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
                  >
                    <IconVideo className="h-5 w-5" />
                    Nova reunião
                  </button>

                  {menuOpen && (
                  <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-slate-100 shadow-xl">
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

              <div className="flex flex-1 items-center gap-2 rounded-full border border-black bg-white px-4 py-3 text-sm shadow-sm">
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

            <div className="mt-6 border-t border-black pt-6">
              {tab === "reunioes" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
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

                  <div className="rounded-2xl border border-slate-200 bg-white shadow-lg">
                    {UPCOMING.map((item, index) => (
                      <div
                        key={item.title}
                        className={`flex items-center gap-6 px-6 py-4 text-sm ${
                          index > 0 ? "border-t border-slate-200" : ""
                        }`}
                      >
                      <span className="w-24 text-[15px] text-slate-500 font-[family:Arial,Helvetica,sans-serif]">
                        {item.when}
                      </span>
                      <span className="text-[15px] font-medium text-black font-[family:Arial,Helvetica,sans-serif]">
                        {item.title}
                      </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500">Na sua conta do Knexit Agenda: usuario@knexit.com</p>
                  <Link href="/violive" className="text-xs font-semibold text-blue-600">
                    Saiba mais sobre o VioLive
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
                  <h2 className="text-lg font-semibold text-slate-900">Ligações</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Faça e receba ligações diretamente no VioLive (em breve).
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>

        {sidebarOpen && <div className="hidden shrink-0 transition-all duration-300 xl:block w-56" aria-hidden />}
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

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="absolute inset-0" onClick={() => setSettingsOpen(false)} aria-hidden />
          <div className="relative w-[900px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl font-[family:Arial,Helvetica,sans-serif]">
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="Fechar"
            >
              <IconClose className="h-5 w-5 text-slate-700" />
            </button>

            <div className="grid min-h-[520px] grid-cols-[260px,1fr]">
              <aside className="border-r border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-900">Configurações</h2>
                <nav className="mt-5 space-y-2">
                  <button
                    className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition ${
                      settingsTab === "audio"
                        ? "bg-[#E7F0FD] text-[#0072E3]"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => setSettingsTab("audio")}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <rect x="9" y="3" width="6" height="12" rx="3" />
                        <path d="M5 11a7 7 0 0 0 14 0" />
                        <path d="M12 18v3" />
                      </svg>
                    </span>
                    Áudio
                  </button>
                  <button
                    className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition ${
                      settingsTab === "video"
                        ? "bg-[#E7F0FD] text-[#0072E3]"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => setSettingsTab("video")}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                      <IconVideo className="h-5 w-5 text-slate-700" />
                    </span>
                    Vídeo
                  </button>
                  <button
                    className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition ${
                      settingsTab === "historico"
                        ? "bg-[#E7F0FD] text-[#0072E3]"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => setSettingsTab("historico")}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M12 8v5l3 2" />
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                    </span>
                    Histórico
                  </button>
                  <button
                    className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition ${
                      settingsTab === "gerais"
                        ? "bg-[#E7F0FD] text-[#0072E3]"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => setSettingsTab("gerais")}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                      <IconSettings className="h-5 w-5 text-slate-700" />
                    </span>
                    Gerais
                  </button>
                </nav>
              </aside>

              <div className="p-6 pt-20">
                {settingsTab === "audio" && (
                  <>
                    <h3 className="text-sm font-semibold text-[#0072E3]">Microfone</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <div className="relative" data-mic>
                        <button
                          type="button"
                          onClick={() => setMicOpen((prev) => !prev)}
                          className="flex w-[420px] items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left"
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.6">
                              <rect x="9" y="3" width="6" height="12" rx="3" />
                              <path d="M5 11a7 7 0 0 0 14 0" />
                            </svg>
                          </span>
                          <span className="text-sm text-slate-700">{selectedMic}</span>
                          <span className="ml-auto text-slate-500">▾</span>
                        </button>
                        {micOpen && (
                          <div className="absolute left-0 top-full z-10 mt-2 w-[420px] rounded-lg border border-slate-200 bg-white shadow-lg">
                            {MIC_DEVICES.map((device) => (
                              <button
                                key={device}
                                type="button"
                                onClick={() => {
                                  setSelectedMic(device);
                                  setMicOpen(false);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                {device}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white">
                        <IconDots className="h-4 w-4" />
                      </button>
                    </div>

                    <h3 className="mt-6 text-sm font-semibold text-[#0072E3]">Alto-falante</h3>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="relative" data-speaker>
                        <button
                          type="button"
                          onClick={() => setSpeakerOpen((prev) => !prev)}
                          className="flex w-[420px] items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left"
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.6">
                              <path d="M11 5 6 9H3v6h3l5 4V5z" />
                              <path d="M16 9a5 5 0 0 1 0 6" />
                            </svg>
                          </span>
                          <span className="text-sm text-slate-700">{selectedSpeaker}</span>
                          <span className="ml-auto text-slate-500">▾</span>
                        </button>
                        {speakerOpen && (
                          <div className="absolute left-0 top-full z-10 mt-2 w-[420px] rounded-lg border border-slate-200 bg-white shadow-lg">
                            {SPEAKER_DEVICES.map((device) => (
                              <button
                                key={device}
                                type="button"
                                onClick={() => {
                                  setSelectedSpeaker(device);
                                  setSpeakerOpen(false);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                {device}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button className="text-sm font-semibold text-slate-700 hover:text-slate-900">Testar</button>
                    </div>
                  </>
                )}

                {settingsTab === "video" && (
                  <>
                    <h3 className="text-sm font-semibold text-[#0072E3]">Câmera</h3>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="relative" data-camera>
                        <button
                          type="button"
                          onClick={() => setCameraOpen((prev) => !prev)}
                          className="flex w-[420px] items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left"
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                            <IconVideo className="h-4 w-4 text-slate-700" />
                          </span>
                          <span className="text-sm text-slate-700">{selectedCamera}</span>
                          <span className="ml-auto text-slate-500">▾</span>
                        </button>
                        {cameraOpen && (
                          <div className="absolute left-0 top-full z-10 mt-2 w-[420px] rounded-lg border border-slate-200 bg-white shadow-lg">
                            {CAMERA_DEVICES.map((device) => (
                              <button
                                key={device}
                                type="button"
                                onClick={() => {
                                  setSelectedCamera(device);
                                  setCameraOpen(false);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                {device}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {settingsTab === "historico" && (
                  <div className="space-y-6 text-sm text-slate-700">
                    <div className="grid justify-center gap-6 md:grid-cols-[1fr,220px]">
                      <div className="space-y-6">
                        <div className="max-w-[420px] space-y-1">
                          <h4 className="text-sm font-semibold text-slate-900">Excluir histórico de ligações</h4>
                          <p className="text-sm text-slate-600">
                            Excluir permanentemente todo o histórico de ligações.
                          </p>
                        </div>
                        <div className="max-w-[420px] space-y-1">
                          <h4 className="text-sm font-semibold text-slate-900">Exportar histórico de ligações</h4>
                          <p className="text-sm text-slate-600">
                            Você pode exportar seu histórico de ligações usando o KnexIT Takeout.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-4">
                        <button className="rounded-full border border-black px-4 py-2 text-sm font-semibold text-[#0072E3] hover:border-black">
                          Excluir seu histórico
                        </button>
                        <button className="rounded-full border border-black px-4 py-2 text-sm font-semibold text-[#0072E3] hover:border-black">
                          Exportar histórico
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-900">Excluir histórico de ligações automaticamente</h4>
                      <div className="relative w-[320px]" data-history-schedule>
                        <button
                          type="button"
                          onClick={() => setHistoryScheduleOpen((prev) => !prev)}
                          className="flex w-full items-center justify-between rounded-lg border-[3px] border-blue-700 bg-white px-3 py-2 text-sm"
                        >
                          <span>{historySchedule}</span>
                          <span className="text-slate-500">▾</span>
                        </button>
                        {historyScheduleOpen && (
                          <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                            {HISTORY_SCHEDULES.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  setHistorySchedule(option);
                                  setHistoryScheduleOpen(false);
                                }}
                                className="flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === "gerais" && (
                  <div className="space-y-6 text-sm text-slate-700">
                    <div className="flex items-start justify-between gap-6">
                      <div className="max-w-[420px] space-y-1">
                        <h4 className="text-sm font-semibold text-slate-900">
                          Enviar informações de diagnóstico adicionais ao Google
                        </h4>
                        <p className="text-sm text-slate-600">
                          O Google usa estes registros do sistema para tornar o Meet melhor.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDiagEnabled((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                          diagEnabled ? "border-blue-600 bg-blue-600" : "border-slate-400 bg-slate-200"
                        }`}
                        aria-pressed={diagEnabled}
                      >
                        <span
                          className={`absolute h-5 w-5 rounded-full bg-white shadow transition ${
                            diagEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-6">
                      <div className="max-w-[420px] space-y-1">
                        <h4 className="text-sm font-semibold text-slate-900">Notificações na área de trabalho</h4>
                        <p className="text-sm text-slate-600">
                          O Meet pode mostrar notificações na área de trabalho para que você atenda a chamadas
                          recebidas e realize outras ações no app.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWorkspaceNotifications((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                          workspaceNotifications ? "border-blue-600 bg-blue-600" : "border-slate-400 bg-slate-200"
                        }`}
                        aria-pressed={workspaceNotifications}
                      >
                        <span
                          className={`absolute h-5 w-5 rounded-full bg-white shadow transition ${
                            workspaceNotifications ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-6">
                      <div className="max-w-[420px] space-y-1">
                        <h4 className="text-sm font-semibold text-slate-900">Sair de chamadas vazias</h4>
                        <p className="text-sm text-slate-600">
                          Remove você depois de alguns minutos se ninguém entra na chamada.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExitEmptyCalls((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                          exitEmptyCalls ? "border-blue-600 bg-blue-600" : "border-slate-400 bg-slate-200"
                        }`}
                        aria-pressed={exitEmptyCalls}
                      >
                        <span
                          className={`absolute h-5 w-5 rounded-full bg-white shadow transition ${
                            exitEmptyCalls ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-6">
                      <div className="max-w-[420px] space-y-1">
                        <h4 className="text-sm font-semibold text-slate-900">Apenas contatos podem me ligar</h4>
                        <p className="text-sm text-slate-600">
                          Contatos do Google e pessoas com quem você interagiu nos Serviços do Google.
                        </p>
                        <button className="text-sm font-semibold text-[#0072E3] hover:underline">
                          Saiba mais sobre os contatos salvos
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOnlyContacts((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                          onlyContacts ? "border-blue-600 bg-blue-600" : "border-slate-400 bg-slate-200"
                        }`}
                        aria-pressed={onlyContacts}
                      >
                        <span
                          className={`absolute h-5 w-5 rounded-full bg-white shadow transition ${
                            onlyContacts ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <div className="space-y-6">
                        <div className="flex items-start justify-between gap-6">
                          <div className="max-w-[420px] space-y-1">
                            <h4 className="text-sm font-semibold text-slate-900">
                              Adicionar ou mudar seu número de telefone
                            </h4>
                            <p className="text-sm text-slate-600">
                              Ao adicionar um número de telefone à sua Conta do Google, é possível fazer e receber
                              ligações com ele.
                            </p>
                          </div>
                          <button className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-[#0072E3] hover:border-slate-400">
                            Adicionar ou mudar
                          </button>
                        </div>

                        <div className="flex items-start justify-between gap-6">
                          <div className="max-w-[420px] space-y-1">
                            <h4 className="text-sm font-semibold text-slate-900">Bloquear pessoas</h4>
                            <p className="text-sm text-slate-600">
                              Apenas autores de ligações individuais podem ser bloqueados. As pessoas que você bloqueou
                              ainda podem participar de reuniões e chamadas em grupo com você.
                            </p>
                          </div>
                          <button className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-[#0072E3] hover:border-slate-400">
                            Ver quem está bloqueado
                          </button>
                        </div>

                        <div className="flex items-start justify-between gap-6">
                          <div className="max-w-[420px] space-y-1">
                            <h4 className="text-sm font-semibold text-slate-900">
                              Recursos inteligentes do Google Workspace
                            </h4>
                            <p className="text-sm text-slate-600">
                              Personalize sua experiência com recursos inteligentes no Workspace e em outros produtos do
                              Google.
                            </p>
                            <button className="text-sm font-semibold text-[#0072E3] hover:underline">
                              Saiba mais sobre os recursos inteligentes do Workspace
                            </button>
                          </div>
                          <button className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-[#0072E3] hover:border-slate-400">
                            Gerenciamento
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {feedbackOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/20" onClick={() => setFeedbackOpen(false)} aria-hidden />
          <div className="absolute right-0 top-0 h-full w-[360px] max-w-[90vw] bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                {feedbackView === "issue" ? (
                  <button
                    type="button"
                    onClick={() => setFeedbackView("root")}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
                  >
                    <IconBack className="h-4 w-4" />
                    Informar um problema
                  </button>
                ) : (
                  <h3 className="text-sm font-semibold text-slate-900">
                    Enviar feedback para o <span className="text-blue-700">KnexIT</span>
                  </h3>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackOpen(false);
                    setFeedbackView("root");
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                  aria-label="Fechar"
                >
                  <IconClose className="h-5 w-5 text-slate-700" />
                </button>
              </div>

              <div className="flex-1 min-h-0">
                {feedbackView === "root" ? (
                  <div className="h-full overflow-y-auto px-5 py-6">
                    <div className="flex items-center justify-center">
                      <div className="flex h-36 w-36 items-center justify-center rounded-full bg-slate-100">
                        <IconLight className="h-16 w-16 text-blue-500" />
                      </div>
                    </div>

                    <div className="mt-6 space-y-4 text-sm">
                      <button
                        className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800"
                        onClick={() => setFeedbackView("issue")}
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-700 text-white transition group-hover:bg-indigo-800">
                          <IconAlert className="h-4 w-4 text-white" />
                        </span>
                        Informar um problema
                      </button>
                      <button className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-700 text-white transition group-hover:bg-indigo-800">
                          <IconIdea className="h-4 w-4 text-white" />
                        </span>
                        Fazer uma sugestão
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col text-sm text-slate-700">
                    <div className="flex-1 overflow-y-auto px-5 py-5">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="font-medium text-slate-900">
                            Quando você percebeu o problema, o que estava tentando fazer? (obrigatório)
                          </p>
                          <div className="relative" data-issue-topic>
                            <button
                              type="button"
                              onClick={() => setIssueTopicOpen((prev) => !prev)}
                              className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                            >
                              {issueTopic}
                              <span className="text-slate-500">▾</span>
                            </button>
                            {issueTopicOpen && (
                              <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                                {ISSUE_TOPICS.map((topic) => (
                                  <button
                                    key={topic}
                                    type="button"
                                    onClick={() => {
                                      setIssueTopic(topic);
                                      setIssueTopicOpen(false);
                                    }}
                                    className="flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    {topic}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="font-medium text-slate-900">Descreva o problema (obrigatório)</p>
                          <textarea
                            className="min-h-[120px] w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Diga o que aconteceu e o que não está funcionando"
                          />
                          <p className="flex items-center gap-2 text-xs text-slate-500">
                            Não inclua informações confidenciais
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px]">
                              ?
                            </span>
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-slate-600">
                            Uma captura de tela vai nos ajudar a entender melhor o problema.
                          </p>
                          <button className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-blue-700">
                            <IconCamera className="h-4 w-4" />
                            Capturar tela
                          </button>
                        </div>

                        <label className="flex items-start gap-3 text-sm text-slate-600">
                          <input type="checkbox" className="mt-1 h-4 w-4" />
                          <span>Autorizo o envio de e-mails para me pedir mais informações ou atualizações</span>
                        </label>

                        <p className="text-[11px] leading-relaxed text-slate-500 text-justify">
                          Algumas informações da conta e do sistema podem ser enviadas ao Knexit. Vamos usar esses dados para
                          corrigir problemas e melhorar nossos serviços, de acordo com nossa{" "}
                          <a className="text-blue-600 hover:underline" href="#">
                            Política de Privacidade
                          </a>{" "}
                          e{" "}
                          <a className="text-blue-600 hover:underline" href="#">
                            Termos de Serviço
                          </a>
                          . Talvez você receba e-mails nossos pedindo mais informações ou com atualizações. Acesse a{" "}
                          <a className="text-blue-600 hover:underline" href="#">
                            página de Ajuda do Jurídico
                          </a>{" "}
                          para pedir mudanças em conteúdo por motivos legais.
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 px-5 py-4">
                      <div className="flex justify-end">
                        <button className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
                          Enviar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

function NavItem({
  label,
  selected = false,
  icon,
  onClick,
}: {
  label: string;
  selected?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-5 rounded-full px-4 pl-[18px] pr-4 text-[14px] font-medium leading-5 transition ${
        selected
          ? "h-14 bg-[#D2E3FF] text-[#0072E3]"
          : "h-14 text-slate-700 hover:bg-[#D2E3FF] hover:text-[#0072E3]"
      }`}
    >
      <span
        className={
          selected
            ? "text-[#0072E3]"
            : "text-slate-600 group-hover:text-[#0072E3]"
        }
      >
        {icon}
      </span>
      <span>{label}</span>
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
const IconAlert = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3 22 20H2z" />
    <path d="M12 9v5" />
    <circle cx="12" cy="17" r="1" />
  </svg>
);
const IconLight = (p: any) => (
  <svg viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p} className={`${p.className ?? ""} overflow-visible`}>
    <path d="M12 3a7 7 0 0 1 7 7c0 2.3-1.2 4.3-3 5.5V18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5C6.2 14.3 5 12.3 5 10a7 7 0 0 1 7-7Z" fill="#FACC15" stroke="#CA8A04" />
    <path d="M9 19h6" stroke="#CA8A04" />
    <path d="M12 -1.2v2" stroke="#F59E0B" />
    <path d="M20.6 2.9l-1.4 1.4" stroke="#F59E0B" />
    <path d="M23.5 12h-2" stroke="#F59E0B" />
    <path d="M0.5 12h2" stroke="#F59E0B" />
    <path d="M3.4 2.9l1.4 1.4" stroke="#F59E0B" />
  </svg>
);
const IconIdea = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 4a7 7 0 0 1 4 12.7V18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1.3A7 7 0 0 1 12 4z" />
    <path d="M9 18h6" />
    <path d="M10 12h4" />
  </svg>
);
const IconBack = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const IconCamera = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="7" width="14" height="10" rx="2" />
    <path d="M17 9l4-2v10l-4-2z" />
  </svg>
);
const IconDots = (p: any) => (
  <svg viewBox="0 0 16 16" fill="currentColor" {...p}>
    {[2, 8, 14].map((x) =>
      [2, 8, 14].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.75" />)
    )}
  </svg>
);
const IconHelp = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.1 9a3 3 0 1 1 4.8 2.4c-.8.5-1.4 1.1-1.4 2v.6M12 17h.01" />
  </svg>
);
const IconChat = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M20 14a4 4 0 0 1-4 4H8l-4 3V7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4z" />
    <path d="M9 12h6M9 15h4" />
  </svg>
);
const IconSettings = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12.55" cy="12" r="3.2" />
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

const MIC_DEVICES = [
  "Microfone (Logi Webcam C920e)",
  "Microfone do sistema",
  "Fone Bluetooth (AirPods)",
];

const SPEAKER_DEVICES = [
  "DELL S3422DWG (NVIDIA High Definition)",
  "Alto-falante do sistema",
  "Fone Bluetooth (AirPods)",
];

const CAMERA_DEVICES = [
  "Logi Webcam C920e",
  "Câmera integrada",
  "Câmera virtual (KnexIt)",
];

const HISTORY_SCHEDULES = ["3 meses", "18 meses", "36 meses", "Nunca"];

const ISSUE_TOPICS = [
  "Entrar em uma reunião",
  "Falar ou ouvir",
  "Ver vídeos dos participantes",
  "Apresentar conteúdo",
  "Ver conteúdo",
  "Outro",
];
