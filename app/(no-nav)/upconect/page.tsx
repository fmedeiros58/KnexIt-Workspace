"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/* =========
   Helpers
========= */
function randomCode() {
  const part = () => Math.random().toString(36).slice(2, 6);
  return `${part()}-${part()}-${part()}`;
}
function buildRoomUrl(code: string) {
  if (typeof window === "undefined") return `/upconect/sala/${code}`;
  return `${window.location.origin}/upconect/sala/${code}`;
}

export default function UpConectLobby() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string>("");
  const [roomInput, setRoomInput] = useState("");

  // fecha o dropdown ao clicar fora
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu]")) setMenuOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    } finally {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }

  function onNewMeeting(action: "link" | "instant" | "agenda") {
    const code = randomCode();
    const url = buildRoomUrl(code);

    if (action === "link") {
      setGeneratedUrl(url);
      setMenuOpen(false);
    } else if (action === "instant") {
      window.location.href = url;
    } else {
      window.location.href = "/upconect/agenda";
    }
  }

  function joinFromInput() {
    let url = roomInput.trim();
    if (!url) return;

    const looksLikeCode = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(url);
    if (looksLikeCode) url = buildRoomUrl(url);

    try {
      const u = new URL(url);
      window.location.href = u.toString();
    } catch {}
  }

  // alturas fixas: header = 64px, footer = 64px  => conteúdo = 100vh - 128px
  const contentHeight = useMemo(() => "calc(100vh - 128px)", []);

  return (
    <div className="h-screen overflow-hidden bg-[#0b1220] text-slate-100 relative">
      {/* Fundo decorativo sem linhas de grade */}
      <BackgroundDecor />

      {/* HEADER fixo */}
      <header className="fixed top-0 inset-x-0 z-40 h-16 flex items-center border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="w-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            {/* Logo MAIOR */}
            <LogoUpConect className="h-12 w-12" />
            <div className="leading-tight">
              <div className="text-2xl font-extrabold tracking-tight">
                <span className="text-rose-500">UP</span>Conect
              </div>
              <div className="text-[11px] text-slate-400 -mt-0.5">
                Reuniões e chamadas sem complicação
              </div>
            </div>
          </div>

          {/* Nav: sem "Cursos", links sem sublinhado e com hover de cor */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/pricing" className="no-underline hover:text-white">Planos</Link>
            <Link href="/suporte" className="no-underline hover:text-white">Suporte</Link>
            <Link
              href="/login"
              className="no-underline inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold
             bg-[#3498db] text-white hover:bg-[#38BDF8] active:bg-[#2ecc71]
             focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:ring-offset-2 focus:ring-offset-black
             transition-colors duration-150"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      {/* CONTEÚDO central — ocupa exatamente o espaço entre header e footer, sem rolar */}
      <main
        className="relative px-6"
        style={{ height: contentHeight, paddingTop: "1rem", paddingBottom: "1rem" }}
      >
        <section className="w-full h-full">
          <div className="grid lg:grid-cols-2 gap-10 h-full">
            {/* Coluna esquerda: títulos + CTAs */}
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                Reuniões em tela cheia,<br className="hidden md:block" /> zero fricção.
              </h1>
              <p className="mt-4 text-slate-300 text-base md:text-lg">
                Crie um link, entre agora ou agende para depois. Qualidade de áudio/vídeo,
                baixa latência e controles que você domina de primeira.
              </p>

              <div className="mt-8 flex flex-col xl:flex-row gap-4">
                {/* Nova reunião (dropdown) */}
                <div className="relative" data-menu>
                  <button
                    onClick={() => setMenuOpen((s) => !s)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 font-semibold shadow"
                  >
                    <IconPlus className="h-5 w-5" />
                    Nova reunião
                    <IconChevron className="h-4 w-4 opacity-80" />
                  </button>
                  {menuOpen && (
                    <div className="absolute left-0 mt-2 w-[320px] rounded-2xl bg-slate-900/90 ring-1 ring-white/10 shadow-2xl overflow-hidden backdrop-blur">
                      <MenuItem
                        icon={<IconLink className="h-5 w-5" />}
                        title="Criar um link para depois"
                        desc="Gere um link e compartilhe"
                        onClick={() => onNewMeeting("link")}
                      />
                      <MenuItem
                        icon={<IconBolt className="h-5 w-5" />}
                        title="Iniciar agora"
                        desc="Crie a sala e entre imediatamente"
                        onClick={() => onNewMeeting("instant")}
                      />
                      <MenuItem
                        icon={<IconCalendar className="h-5 w-5" />}
                        title="Agendar"
                        desc="Defina uma reunião futura"
                        onClick={() => onNewMeeting("agenda")}
                      />
                    </div>
                  )}
                </div>

                {/* Entrar com código/link — ocupa o resto da linha */}
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-2xl ring-1 ring-white/10 px-3 py-2 w-full bg-white/5">
                    <IconKeyboard className="h-5 w-5 text-slate-300" />
                    <input
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      onKeyDown={(e) => (e.key === "Enter" ? joinFromInput() : null)}
                      className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
                      placeholder="Digite um código ou cole um link"
                    />
                  </div>
                  <button
                    onClick={joinFromInput}
                    className="no-underline inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold
             bg-[#3498db] text-white hover:bg-[#38BDF8] active:bg-[#2ecc71]
             focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:ring-offset-2 focus:ring-offset-black
             transition-colors duration-150"
                  >
                    Participar
                  </button>
                </div>
              </div>

              {generatedUrl && (
                <div className="mt-4 flex items-center gap-2 rounded-xl ring-1 ring-white/10 px-3 py-2 bg-white/5">
                  <IconLink className="h-5 w-5 text-slate-300" />
                  <input
                    value={generatedUrl}
                    readOnly
                    className="flex-1 bg-transparent text-[15px] outline-none"
                  />
                  <button
                    onClick={() => copyLink(generatedUrl)}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-sm"
                  >
                    {copied ? (
                      <>
                        <IconCheck className="h-4 w-4" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <IconCopy className="h-4 w-4" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Coluna direita: PREVIEW com imagem do /public */}
            <div className="relative flex items-center">
              <div className="w-full aspect-video max-h-[min(58vh,520px)] mx-auto rounded-3xl ring-1 ring-white/10 bg-black overflow-hidden shadow-2xl">
                {/* 
                  ✅ Coloque sua imagem em /public e troque o src abaixo.
                  Ex.: salve "call-preview.jpg" em /public e use src="/call-preview.jpg"
                */}
                <img
                  src="/upconect/imagem-lobby-upconect.png" // <-- TROQUE AQUI PELO NOME DO ARQUIVO NO /public
                  alt="Prévia de uma chamada no UpConect"
                  className="relative w-full max-w-4xl aspect-[16/9] bg-white overflow-hidden rounded-2xl"
                />

                {/* Badges (mantidos) */}
                <div className="absolute left-4 bottom-4 flex items-center gap-2">
                  <Badge>HD</Badge>
                  <Badge>Baixa latência</Badge>
                  <Badge>Criptografado</Badge>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER fixo com COPYRIGHT CENTRALIZADO (2025) */}
      <footer className="fixed bottom-0 inset-x-0 h-16 border-t border-white/10 bg-black/40 backdrop-blur z-40">
        {/* Grid de 3 colunas: esquerda vazia, centro copyright, direita links */}
        <div className="w-full h-full px-6 text-sm text-slate-300 grid grid-cols-3 items-center">
          <div /> {/* coluna esquerda vazia para permitir centralização real */}
          <div className="justify-self-center">
            {/* Centralizado e fixo para 2025, conforme solicitado */}
            © 2025 UpConect
          </div>
          <div className="justify-self-end flex items-center gap-4">
            <Link href="/terms" className="no-underline hover:text-white">Termos</Link>
            <Link href="/privacy" className="no-underline hover:text-white">Privacidade</Link>
            <Link href="/suporte" className="no-underline hover:text-white">Ajuda</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* =========
   Background decor (sem linhas de grade)
========= */
function BackgroundDecor() {
  return (
    <>
      {/* gradiente base */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent_70%),linear-gradient(to_bottom,#0b1220,#0b1220_40%,#0f172a)]" />
      {/* ❌ Removido: grid de linhas (grades) */}
      {/* blobs animados */}
      <div className="absolute -z-10 blur-3xl opacity-30 pointer-events-none">
        <div className="absolute w-[42vw] h-[42vw] max-w-[640px] max-h-[640px] bg-indigo-600/40 rounded-full -top-20 -left-20 animate-float-slow" />
        <div className="absolute w-[32vw] h-[32vw] max-w-[520px] max-h-[520px] bg-emerald-500/40 rounded-full -bottom-24 -right-16 animate-float-slower" />
      </div>
      <style jsx global>{`
        @keyframes float-slow {
          0% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(20px,-10px,0) scale(1.05); }
          100% { transform: translate3d(0,0,0) scale(1); }
        }
        @keyframes float-slower {
          0% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(-16px,12px,0) scale(1.06); }
          100% { transform: translate3d(0,0,0) scale(1); }
        }
        .animate-float-slow { animation: float-slow 12s ease-in-out infinite; }
        .animate-float-slower { animation: float-slower 16s ease-in-out infinite; }
      `}</style>
    </>
  );
}

/* =========
   Partials
========= */
function MenuItem({
  icon, title, desc, onClick,
}: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
        {icon}
      </span>
      <span>
        <div className="text-[15px] font-medium text-white">{title}</div>
        <div className="text-[12px] text-slate-300">{desc}</div>
      </span>
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] tracking-wide uppercase bg-white/10 text-white rounded-full px-2 py-1 ring-1 ring-white/20">
      {children}
    </span>
  );
}

/* =========
   Ícones
========= */
function LogoUpConect({ className = "" }: { className?: string }) {
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
const IconChevron = (p: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M7 10l5 5 5-5" />
  </svg>
);
const IconLink = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13" />
    <path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11" />
  </svg>
);
const IconBolt = (p: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
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
const IconCopy = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <rect x="2" y="2" width="13" height="13" rx="2" />
  </svg>
);
const IconCheck = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
