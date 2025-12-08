"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Room as LKRoom,
  RoomEvent,
  createLocalTracks,
  Track,
} from "livekit-client";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles"; // estilos base dos componentes

export default function VioLiveSalaPage({ params }: { params: { code: string } }) {
  const code = params.code;

  // UI
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // LiveKit
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const roomRef = useRef<LKRoom | null>(null);

  // Prévia local no lobby (getUserMedia direto para não depender do provedor aqui)
  const localPreviewRef = useRef<HTMLVideoElement | null>(null);
  const localPreviewStreamRef = useRef<MediaStream | null>(null);

  const roomUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/VioLive/sala/${code}`;
  }, [code]);

  // ======= Pré-visualização no lobby =======
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        });
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        localPreviewStreamRef.current = s;
        if (localPreviewRef.current) {
          localPreviewRef.current.srcObject = s;
          await localPreviewRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setErrorMsg(
          e?.name === "NotAllowedError"
            ? "Permissão negada. Autorize câmera/microfone."
            : "Não foi possível acessar câmera/microfone."
        );
      }
    })();

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "m") toggleMic();
      if (e.key.toLowerCase() === "v") toggleCam();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      localPreviewStreamRef.current?.getTracks().forEach(t => t.stop());
      localPreviewStreamRef.current = null;
      // encerra LiveKit se estava conectado
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======= Entrar na reunião (conectar LiveKit) =======
  async function joinRoom() {
    try {
      // pega token do nosso endpoint
      const res = await fetch(
        `/api/livekit-token?room=${encodeURIComponent(code)}&identity=${encodeURIComponent(
          identity ?? ""
        )}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao obter token");
      setToken(data.token);
      setServerUrl(data.url);
      setIdentity(data.identity);

      // prepara tracks locais respeitando toggles
      const tracks = await createLocalTracks({
        audio: micOn ? { echoCancellation: true, noiseSuppression: true } : false,
        // cast to any because the livekit types for VideoCaptureOptions are narrower in this build
        video: camOn ? ({ facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } as any) : false,
      });

      const room = new LKRoom({
        adaptiveStream: true,
        dynacast: true,
      });

      // eventos básicos (opcional: logs)
      room
        .on(RoomEvent.Disconnected, () => {
          setScreenOn(false);
        })
        .on(RoomEvent.ParticipantConnected, (p) => {
          // console.log("participant joined", p.identity);
        });

      await room.connect(data.url, data.token);
      // publica os tracks criados
      for (const t of tracks) {
        await room.localParticipant.publishTrack(t);
      }

      // já que usamos prévia própria, paramos o preview para liberar cam/mic
      localPreviewStreamRef.current?.getTracks().forEach(t => t.stop());
      localPreviewStreamRef.current = null;

      roomRef.current = room;
      setJoined(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao conectar na sala.");
    }
  }

  // ======= Toggles atuando nos tracks já publicados =======
  function toggleMic() {
    const room = roomRef.current;
    if (!room) {
      // lobby: apenas marca o estado; a publicação real vai seguir no join
      setMicOn(v => !v);
      return;
    }
    const next = !micOn;
    setMicOn(next);
    room.localParticipant.setMicrophoneEnabled(next);
  }
  function toggleCam() {
    const room = roomRef.current;
    if (!room) {
      setCamOn(v => !v);
      return;
    }
    const next = !camOn;
    setCamOn(next);
    room.localParticipant.setCameraEnabled(next);
  }

  async function toggleScreenShare() {
    const room = roomRef.current;
    if (!room) return;
    const next = !screenOn;
    setScreenOn(next);
    await room.localParticipant.setScreenShareEnabled(next);
  }

  // foca o botão entrar no lobby
  useEffect(() => {
    if (!joined) {
      const btn = document.getElementById("enter-room-btn") as HTMLButtonElement | null;
      btn?.focus();
    }
  }, [joined]);

  return (
    <div className="min-h-screen bg-white">
      {/* Topo */}
      <header className="fixed inset-x-0 top-0 z-50 bg-white/70 backdrop-blur pointer-events-none">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-3">
          <LogoVioLive className="h-8 w-8 pointer-events-auto" />
          <div className="pointer-events-auto select-none">
            <div className="text-lg font-extrabold tracking-tight text-slate-900">
              <span className="text-red-600">UP</span>Conect
            </div>
            <div className="text-[11px] text-slate-500 -mt-0.5">Sala de reunião</div>
          </div>
          <div className="ml-auto pointer-events-auto">
            <Link
              href="/VioLive"
              className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-semibold hover:bg-slate-800 no-underline"
            >
              ← Voltar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-24 pb-14">
        {!joined ? (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Prévia local */}
            <div className="rounded-2xl ring-1 ring-slate-200 bg-black/5 aspect-video overflow-hidden relative">
              <video
                ref={localPreviewRef}
                muted
                playsInline
                className="h-full w-full object-cover origin-center scale-x-[-1]"
              />
              {!camOn && (
                <div className="absolute inset-0 grid place-items-center bg-slate-900/70 text-white">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-2xl overflow-hidden">
                      <LogoVioLive className="h-16 w-16" />
                    </div>
                    <p className="text-sm opacity-90">Câmera desligada</p>
                  </div>
                </div>
              )}
            </div>

            {/* Info + controles */}
            <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-6 shadow-sm">
              <h1 className="text-xl font-bold text-slate-900">Pronto para entrar?</h1>
              <p className="text-slate-600 mt-1">
                Código da sala: <span className="font-mono text-slate-900">{code}</span>
              </p>

              {errorMsg && (
                <div className="mt-3 rounded-lg bg-amber-50 text-amber-900 px-3 py-2 text-sm ring-1 ring-amber-200">
                  {errorMsg}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 rounded-xl ring-1 ring-slate-200 px-3 py-2">
                <IconLink className="h-5 w-5 text-slate-400" />
                <input value={roomUrl} readOnly className="flex-1 text-[15px] outline-none" />
                <button
                  onClick={() => navigator.clipboard.writeText(roomUrl)}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-sm"
                >
                  <IconCopy className="h-4 w-4" />
                  Copiar link
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ToggleButton
                  active={micOn}
                  onClick={toggleMic}
                  iconOn={<IconMicOn className="h-5 w-5" />}
                  iconOff={<IconMicOff className="h-5 w-5" />}
                  labelOn="Microfone ligado (M)"
                  labelOff="Microfone desligado (M)"
                />
                <ToggleButton
                  active={camOn}
                  onClick={toggleCam}
                  iconOn={<IconCamOn className="h-5 w-5" />}
                  iconOff={<IconCamOff className="h-5 w-5" />}
                  labelOn="Câmera ligada (V)"
                  labelOff="Câmera desligada (V)"
                />
              </div>

              <div className="mt-6">
                <button
                  id="enter-room-btn"
                  onClick={joinRoom}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 font-semibold shadow"
                >
                  Entrar na reunião
                </button>
              </div>
            </div>
          </div>
        ) : (
          // ===== Dentro da sala (LiveKitRoom + grid automática) =====
          <LiveKitRoom
            token={token!}
            serverUrl={serverUrl!}
            connect={true}
            // quando sair/fechar aba, desconecta e libera tracks
            onDisconnected={() => {
              setScreenOn(false);
              roomRef.current = null;
            }}
            data-lk-theme="default"
            style={{ height: "100%", width: "100%" }}
          >
            <TopBar
              roomUrl={roomUrl}
              onShare={toggleScreenShare}
              screenOn={screenOn}
              onLeave={() => (window.location.href = "/VioLive")}
            />
            <VideoGrid />
            <BottomBar
              micOn={micOn}
              camOn={camOn}
              toggleMic={toggleMic}
              toggleCam={toggleCam}
              toggleScreen={toggleScreenShare}
              screenOn={screenOn}
            />
          </LiveKitRoom>
        )}
      </main>
    </div>
  );
}

/* ===== Subcomponentes de layout da sala ===== */
function VideoGrid() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  return (
    <div className="mt-4">
      <GridLayout tracks={tracks} style={{ height: "60vh" }}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}

function TopBar({
  roomUrl,
  onShare,
  screenOn,
  onLeave,
}: {
  roomUrl: string;
  onShare: () => void;
  screenOn: boolean;
  onLeave: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(roomUrl)}
          className="rounded-lg ring-1 ring-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
        >
          Copiar link
        </button>
        <button
          onClick={onShare}
          className={[
            "rounded-lg px-3 py-2 text-sm ring-1 transition-colors",
            screenOn ? "bg-slate-900 text-white ring-slate-800" : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50",
          ].join(" ")}
        >
          {screenOn ? "Parar tela" : "Compartilhar tela"}
        </button>
        <button
          onClick={onLeave}
          className="rounded-lg bg-rose-600 text-white px-3 py-2 text-sm font-semibold hover:bg-rose-500"
        >
          Sair
        </button>
      </div>
    </div>
  );
}

function BottomBar({
  micOn,
  camOn,
  toggleMic,
  toggleCam,
  toggleScreen,
  screenOn,
}: {
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  toggleScreen: () => void;
  screenOn: boolean;
}) {
  return (
    <div className="sticky bottom-6 mx-auto max-w-xl mt-4 flex items-center justify-center gap-3">
      <ToggleButton
        active={micOn}
        onClick={toggleMic}
        iconOn={<IconMicOn className="h-5 w-5" />}
        iconOff={<IconMicOff className="h-5 w-5" />}
        labelOn="Microfone (M)"
        labelOff="Microfone (M)"
      />
      <ToggleButton
        active={camOn}
        onClick={toggleCam}
        iconOn={<IconCamOn className="h-5 w-5" />}
        iconOff={<IconCamOff className="h-5 w-5" />}
        labelOn="Câmera (V)"
        labelOff="Câmera (V)"
      />
      <button
        onClick={toggleScreen}
        className={[
          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 transition-colors",
          screenOn ? "bg-slate-900 text-white ring-slate-800" : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50",
        ].join(" ")}
      >
        <IconScreen className="h-5 w-5" />
        {screenOn ? "Parar tela" : "Compartilhar tela"}
      </button>
    </div>
  );
}

/* ===== Botões reutilizáveis ===== */
function ToggleButton({
  active,
  onClick,
  iconOn,
  iconOff,
  labelOn,
  labelOff,
}: {
  active: boolean;
  onClick: () => void;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 transition-colors",
        active ? "bg-slate-900 text-white ring-slate-800" : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50",
      ].join(" ")}
    >
      {active ? iconOn : iconOff}
      {active ? labelOn : labelOff}
    </button>
  );
}

/* ===== Ícones ===== */
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
const IconLink = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13" /><path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11" /></svg>);
const IconCopy = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><rect x="2" y="2" width="13" height="13" rx="2" /></svg>);
const IconMicOn = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><rect x="8" y="4" width="8" height="12" rx="4" /><path d="M12 20v-3M5 12a7 7 0 0 0 14 0" /></svg>);
const IconMicOff = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="M10 5a4 4 0 0 1 8 0v5M4 20L20 4" /></svg>);
const IconCamOn = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 9l5-3v12l-5-3z" /></svg>);
const IconCamOff = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="M3 7h13v10H3zM16 9l5-3v12l-5-3zM4 20L20 4" /></svg>);
const IconScreen = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /></svg>);

