"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Room,
  RoomEvent,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  LocalTrack,
  RemoteParticipant,
  TrackPublication,
  Track,
  DisconnectReason,
  ConnectionState,
  createLocalTracks,
  ParticipantEvent,
} from "livekit-client";
import { saveRecording } from "@/lib/recstore";

/** ===== Ajustes rápidos ===== */
const RIGHT_PANEL_W = 360;
const GRID_COLS_WHEN_SCREEN = "1.1fr 1.9fr";
const TILE_MIN_W = 300;

export type PanelKey = "people" | "chat" | "tools" | "host";

/** =========
 * Helper: garante que a track de vídeo tenha width/height antes de publicar
 * ========= */
async function ensureVideoDimensions(track: LocalVideoTrack) {
  const s = (track as any)?.mediaStreamTrack?.getSettings?.();
  if (s?.width && s?.height) return;

  await new Promise<void>((resolve) => {
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    el.style.position = "fixed";
    el.style.left = "-99999px";
    el.style.top = "-99999px";
    document.body.appendChild(el);

    const cleanup = () => {
      try {
        track.detach(el);
      } catch {}
      el.remove();
      resolve();
    };

    const to = setTimeout(cleanup, 800);
    el.onloadedmetadata = () => {
      clearTimeout(to);
      cleanup();
    };

    track.attach(el);
  });
}

function normalizeWsUrl(u: string) {
  if (!u) return u;
  try {
    const url = new URL(u);
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol === "http:") url.protocol = "ws:";
    return url.toString();
  } catch {
    return u.replace(/^https?:\/\//i, (m) => (m.toLowerCase().startsWith("https") ? "wss://" : "ws://"));
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  // rota e query
  const { code } = useParams<{ code: string }>();
  const sp = useSearchParams();
  const joined = sp.get("joined") === "1";
  const camIdQS = sp.get("camId") || undefined;
  const micIdQS = sp.get("micId") || undefined;
  const camOnQS = sp.get("camOn") === "1";
  const micOnQS = sp.get("micOn") === "1";

  // livekit + estado do layout
  const [phase, setPhase] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string>("");
  const [connState, setConnState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [serverUrlUsed, setServerUrlUsed] = useState<string>("");
  const [eventsLog, setEventsLog] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);
  const localTracksRef = useRef<LocalTrack[]>([]);
  const connectedRef = useRef(false);
  const connectingRef = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  const [micOn, setMicOn] = useState<boolean>(micOnQS);
  const [camOn, setCamOn] = useState<boolean>(camOnQS);
  const [screenOn, setScreenOn] = useState<boolean>(false);
  const [captionsOn, setCaptionsOn] = useState<boolean>(false);
  const [handRaised, setHandRaised] = useState<boolean>(false);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  // Estados de visualização (para o menu "Mais")
  const [viewMode, setViewMode] = useState<"auto" | "mosaic" | "spotlight" | "sidebar">("auto");
  const [gridMaxTiles, setGridMaxTiles] = useState<number>(9);
  const [hideNoVideo, setHideNoVideo] = useState<boolean>(false);

  // ===== Gravação (local, via MediaRecorder)
  const [recording, setRecording] = useState<boolean>(false);
  const [recordings, setRecordings] = useState<{ url: string; size: number; startedAt: number }[]>([]);
  const [recError, setRecError] = useState<string>("");
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    if (recording) return;
    setRecError("");
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      recStreamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" });
      mediaRecRef.current = mr;
      recChunksRef.current = [];
      mr.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size) recChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        try {
          const blob = new Blob(recChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          setRecordings((prev) => [{ url, size: blob.size, startedAt: Date.now() }, ...prev]);
          try {
            const name = `Gravação ${new Date().toLocaleString()}`;
            await saveRecording(name, blob);
          } catch (e) {
            // silencioso: fallback fica disponível na lista local
          }
        } catch (err: any) {
          setRecError(err?.message || String(err));
        }
        recChunksRef.current = [];
        try { stream.getTracks().forEach((t: MediaStreamTrack) => t.stop()); } catch {}
        recStreamRef.current = null;
      };
      mr.start(250);
      setRecording(true);
    } catch (err: any) {
      setRecError(err?.message || String(err));
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    try { mediaRecRef.current?.stop(); } catch {}
    mediaRecRef.current = null;
    setRecording(false);
  };

  const [micDevices, setMicDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [camDevices, setCamDevices] = useState<{ deviceId: string; label: string }[]>([]);

  // medir altura real da BottomBar
  const barWrapRef = useRef<HTMLDivElement | null>(null);
  const [barH, setBarH] = useState<number>(84);

  // URL absoluta sem causar hidratação desigual
  const absoluteRoomUrl = useMemo(
    () => (typeof window !== "undefined" ? window.location.href : `/upconect/sala/${code}`),
    [code]
  );

  const pushEvent = (msg: string) => {
    setEventsLog((prev) => [new Date().toLocaleTimeString() + " • " + msg, ...prev].slice(0, 8));
  };

  // suprimir overlay “Client initiated disconnect” em dev/HMR
  useEffect(() => {
    const onUR = (e: PromiseRejectionEvent) => {
      try {
        const msg =
          (typeof e.reason === "string" && e.reason) ||
          (e.reason?.message as string) ||
          String(e.reason ?? "");
        if (msg && msg.toLowerCase().includes("client initiated disconnect")) {
          e.preventDefault();
          console.info("[LiveKit] Client initiated disconnect (suprimido em dev).");
        }
      } catch {}
    };
    window.addEventListener("unhandledrejection", onUR);
    return () => window.removeEventListener("unhandledrejection", onUR);
  }, []);

  // aplicar largura do sidebar via CSS var
  useEffect(() => {
    const w = activePanel ? RIGHT_PANEL_W : 0;
    document.documentElement.style.setProperty("--right-panel-w", `${w}px`);
  }, [activePanel]);

  // observar altura da BottomBar
  useEffect(() => {
    const el = barWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry?.contentRect.height ?? 0;
      if (h && Math.abs(h - barH) > 0.5) setBarH(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [barH]);

  // conectar no LiveKit quando "joined"
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      if (!joined || connectedRef.current || connectingRef.current) return;

      setPhase("connecting");
      setErrMsg("");
      setEventsLog([]);
      connectingRef.current = true;

      try {
        const params = new URLSearchParams({ room: String(code) });
        const res = await fetch(`/api/livekit-token?${params.toString()}`, { method: "GET" });
        if (!res.ok) throw new Error(`Falha ao obter token (${res.status})`);
        const { token, url } = (await res.json()) as { token: string; url?: string };

        const envUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        const rawUrl = url || envUrl || "";
        const serverUrl = normalizeWsUrl(rawUrl);
        setServerUrlUsed(serverUrl);

        if (!serverUrl) {
          throw new Error(
            "LIVEKIT url ausente (token API não retornou 'url' e NEXT_PUBLIC_LIVEKIT_URL não está definido)."
          );
        }
        // exigir ws(s)
        if (!/^wss?:\/\//i.test(serverUrl)) {
          throw new Error(`URL inválida: "${serverUrl}". Deve começar com wss:// ou ws:// (preferir wss://).`);
        }
        if (location.protocol === "https:" && serverUrl.startsWith("ws://")) {
          throw new Error(`Mixed content bloqueado: página HTTPS conectando a ws://. Use wss:// no servidor LiveKit.`);
        }
        if (rawUrl && rawUrl !== serverUrl) {
          pushEvent(`URL convertida: ${rawUrl} → ${serverUrl}`);
        }

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        // listeners principais
        room
          .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
            setConnState(state);
            pushEvent("ConnectionState: " + state);
            if (state === ConnectionState.Connected) {
              connectedRef.current = true;
              setPhase("live");
            } else if (state === ConnectionState.Disconnected) {
              const wasLive = connectedRef.current;
              connectedRef.current = false;
              if (!cancelled) setPhase(wasLive ? "idle" : "error");
            }
          })
          .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
            pushEvent("Disconnected: " + (reason ?? "unknown"));
            if (!cancelled) {
              const wasLive = connectedRef.current;
              connectedRef.current = false;
              setPhase(wasLive ? "idle" : "error");
              if (!wasLive) {
                setErrMsg("Desconectado durante a conexão. Motivo: " + (reason ?? "—"));
              }
            }
          });

        // conecta ao servidor LiveKit
        await room.connect(serverUrl, token);
        pushEvent("connect() chamado com sucesso");

        // cria/pública tracks conforme QS iniciais (forçando resolução p/ evitar warning de dimensões)
        const tracks = (await createLocalTracks({
          video: camOnQS
            ? {
                deviceId: camIdQS,
                resolution: { width: 1280, height: 720 },
                frameRate: 30,
              }
            : false,
          audio: micOnQS ? { deviceId: micIdQS } : false,
        })) as LocalTrack[];

        localTracksRef.current = tracks;

        for (const t of tracks) {
          if (t.kind === Track.Kind.Video && camOnQS) {
            await ensureVideoDimensions(t as LocalVideoTrack);
            await room.localParticipant.publishTrack(t as LocalVideoTrack);
          }
          if (t.kind === Track.Kind.Audio && micOnQS) {
            await room.localParticipant.publishTrack(t as LocalAudioTrack);
          }
        }

        setMicOn(micOnQS);
        setCamOn(camOnQS);
        setScreenOn(false);

        try {
          const list = await navigator.mediaDevices.enumerateDevices();
          setMicDevices(
            list.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label }))
          );
          setCamDevices(
            list.filter((d) => d.kind === "videoinput").map((d) => ({ deviceId: d.deviceId, label: d.label }))
          );
        } catch {}
      } catch (e: any) {
        const msg = e?.message || String(e);
        pushEvent("Connect catch: " + msg);
        setErrMsg(msg);
        setPhase("error");
      } finally {
        connectingRef.current = false;
      }
    }

    connect();

    return () => {
      cancelled = true;
      try {
        roomRef.current?.disconnect();
      } catch {}
      roomRef.current = null;
      localTracksRef.current.forEach((t) => t.stop());
      localTracksRef.current = [];
      connectedRef.current = false;
      connectingRef.current = false;
      setConnState(ConnectionState.Disconnected);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, code, camOnQS, micOnQS, camIdQS, micIdQS, retryTick]);

  // handlers bottom bar
  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!micOn);
      setMicOn((v) => !v);
    } catch (e) {
      pushEvent("toggleMic error: " + (e as any)?.message);
    }
  };
  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setCameraEnabled(!camOn);
      setCamOn((v) => !v);
    } catch (e) {
      pushEvent("toggleCam error: " + (e as any)?.message);
    }
  };
  const toggleScreen = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(!screenOn, { audio: false });
      setScreenOn((v) => !v);
    } catch (e) {
      pushEvent("toggleScreen error: " + (e as any)?.message);
    }
  };
  const selectMic = async (id: string) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.localParticipant.setMicrophoneEnabled(true, { deviceId: id });
      setMicOn(true);
    } catch (e) {
      pushEvent("selectMic error: " + (e as any)?.message);
    }
  };
  const selectCam = async (id: string) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setCameraEnabled(false);
      await room.localParticipant.setCameraEnabled(true, { deviceId: id });
      setCamOn(true);
    } catch (e) {
      pushEvent("selectCam error: " + (e as any)?.message);
    }
  };

  // Garantia: se o estado diz que a câmera está ligada, mas nenhuma track de câmera
  // local está publicada (pode acontecer em alguns ambientes/eventos), força a publicação.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !camOn) return;
    try {
      const pubsIter =
        room.localParticipant?.trackPublications &&
        typeof room.localParticipant.trackPublications.values === "function"
          ? room.localParticipant.trackPublications.values()
          : ([] as any[]).values();

      let hasLocalCam = false;
      for (const pub of pubsIter as Iterable<TrackPublication>) {
        const track = (pub as any)?.track as Track | undefined;
        const isScreen =
          (pub as any).source === (Track as any).Source?.ScreenShare ||
          (track as any)?.source === (Track as any).Source?.ScreenShare;
        if (track?.kind === Track.Kind.Video && !isScreen) {
          hasLocalCam = true;
          break;
        }
      }

      if (!hasLocalCam) {
        room.localParticipant
          .setCameraEnabled(true, camIdQS ? { deviceId: camIdQS } : undefined)
          .catch(() => {});
      }
    } catch {}
  }, [camOn, camIdQS]);

  const retry = () => {
    setPhase("idle");
    setErrMsg("");
    setEventsLog([]);
    setRetryTick((x) => x + 1);
  };

  // ======== UI ========

  // DebugHUD removido

  // se não joined, mostra lobby (children)
  if (!joined) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden">
      {/* Debug oculto */}

      <div
        className="relative grid flex-1 min-h-0 overflow-hidden gap-6"
        style={{
          gridTemplateColumns: "1fr auto",
          height: `calc(100dvh - ${barH}px)`,
        }}
      >
        {/* Palco */}
        <main className="relative overflow-hidden min-h-0 min-w-0 h-full">
          <LiveStage
            roomRef={roomRef}
            connState={connState}
            viewMode={viewMode}
            gridMaxTiles={gridMaxTiles}
            hideNoVideo={hideNoVideo}
            camOn={camOn}
            showPlaceholders={phase !== "live"}
          />
        </main>

        {/* Sidebar */}
        <aside
          className={
            "hidden md:flex flex-col overflow-y-auto min-h-0 border-l " +
            (activePanel === "tools" ? "bg-white text-black border-white/20" : "bg-[#0f0f0f] text-white border-white/10")
          }
          style={{ width: "var(--right-panel-w, 0px)", transition: "width 240ms ease" }}
        >
          {activePanel ? (
            <SidebarPanels
              panel={activePanel}
              recording={recording}
              recordings={recordings}
              recError={recError}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              driveHref="/upconect/drive"
            />
          ) : null}
        </aside>
      </div>

      {/* BottomBar fixo */}
      <div ref={barWrapRef} className="fixed inset-x-0 bottom-0 z-50">
        <BottomBar
          roomCode={String(code)}
          absoluteRoomUrl={absoluteRoomUrl}
          participantsCount={roomRef.current ? roomRef.current.remoteParticipants.size + 1 : 0}
          unreadChat={0}
          micOn={micOn}
          camOn={camOn}
          screenOn={screenOn}
          captionsOn={captionsOn}
          handRaised={handRaised}
          activePanel={activePanel}
          micDevices={micDevices}
          camDevices={camDevices}
          onMic={toggleMic}
          onCam={toggleCam}
          onScreen={toggleScreen}
          onCaptions={() => setCaptionsOn((v) => !v)}
          onRaiseHand={() => setHandRaised((v) => !v)}
          onSelectMicDevice={selectMic}
          onSelectCamDevice={selectCam}
          onMore={() => {}}
          onCaretUp={() => {}}
          onHangup={async () => {
            try {
              await roomRef.current?.disconnect();
            } finally {
              window.location.href = "/upconect";
            }
          }}
          onOpenPanel={(p) => setActivePanel(p)}
          onSelectViewMode={(m) => setViewMode(m)}
          onChangeGridMax={(n) => setGridMaxTiles(n)}
          onToggleHideNoVideo={() => setHideNoVideo((v) => !v)}
        />
      </div>
    </div>
  );
}

/* ===========================
   LiveStage — câmeras à ESQ / apresentação à DIR
=========================== */
function LiveStage({
  roomRef,
  connState,
  viewMode = "auto",
  gridMaxTiles = 9,
  hideNoVideo = false,
  camOn = true,
  showPlaceholders = false,
}: {
  roomRef: React.MutableRefObject<Room | null>;
  connState: ConnectionState;
  viewMode?: "auto" | "mosaic" | "spotlight" | "sidebar";
  gridMaxTiles?: number;
  hideNoVideo?: boolean;
  camOn?: boolean;
  showPlaceholders?: boolean;
}) {
  const [videoTiles, setVideoTiles] = useState<
    { id: string; track: LocalVideoTrack | RemoteVideoTrack; isLocal: boolean }[]
  >([]);
  const [screenTrack, setScreenTrack] = useState<LocalVideoTrack | RemoteVideoTrack | null>(null);
  const [audioTracks, setAudioTracks] = useState<RemoteAudioTrack[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioElsRef = useRef<Map<RemoteAudioTrack, HTMLAudioElement>>(new Map());
  const audioEnabledRef = useRef(false);
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  

  const gridRef = useRef<HTMLDivElement | null>(null); // câmeras (ESQ)
  const screenRef = useRef<HTMLDivElement | null>(null); // apresentação (DIR)
  const primaryRef = useRef<HTMLDivElement | null>(null); // palco principal quando não há apresentação
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [filmstripW, setFilmstripW] = useState<number>(300);

  const getTrackKey = (track: Track | undefined | null) => {
    if (!track) return "";
    return (
      (track as any).sid ||
      (track as any)?.mediaStreamTrack?.id ||
      (track as any).id ||
      String(track)
    );
  };

  // fallback para garantir tile principal quando não há apresentação
  useEffect(() => {
    if (screenTrack) return;
    if (!videoTiles.length) return;
    if (!primaryId || !videoTiles.some((t) => t.id === primaryId)) {
      const next = videoTiles.find((t) => t.isLocal)?.id || videoTiles[0]?.id || null;
      if (next) setPrimaryId(next);
    }
  }, [videoTiles, screenTrack, primaryId]);

  // Sonda periódica: garante que tracks locais publicadas após a conexão
  // também apareçam no array de vídeos (cobre casos em que eventos variam por ambiente)
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    let disposed = false;
    const scan = () => {
      if (disposed) return;
      try {
        const pubsIter =
          room.localParticipant?.trackPublications &&
          typeof room.localParticipant.trackPublications.values === "function"
            ? room.localParticipant.trackPublications.values()
            : ([] as any[]).values();
        for (const pub of pubsIter as Iterable<TrackPublication>) {
          const track = (pub as any)?.track as Track | undefined;
          if (!track || track.kind !== Track.Kind.Video) continue;
          const id = (pub as any).trackSid ?? (track as any).sid ?? `local-${Math.random().toString(36).slice(2)}`;
          setVideoTiles((prev) => (prev.some((t) => t.id === id) ? prev : [...prev, { id, track: track as LocalVideoTrack, isLocal: true }]));
          setPrimaryId((cur) => cur ?? id);
        }
      } catch {}
    };
    const iv = setInterval(scan, 700);
    // primeira tentativa imediata
    scan();
    return () => {
      disposed = true;
      clearInterval(iv);
    };
  }, [roomRef]);

  // coleta inicial + listeners (reativa quando o estado de conexão muda)
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;

    const nextTiles: { id: string; track: LocalVideoTrack | RemoteVideoTrack; isLocal: boolean }[] = [];
    const nextAudios = new Set<RemoteAudioTrack>();
    let scr: LocalVideoTrack | RemoteVideoTrack | null = null;

    // LOCAL
    const localPubsIter =
      room.localParticipant?.trackPublications &&
      typeof room.localParticipant.trackPublications.values === "function"
        ? room.localParticipant.trackPublications.values()
        : ([] as any[]).values();

    for (const pub of localPubsIter as Iterable<TrackPublication>) {
      const track = pub?.track;
      if (!track) continue;

      const isScreen =
        (pub as any).source === (Track as any).Source?.ScreenShare ||
        (track as any).source === (Track as any).Source?.ScreenShare;

      if (isScreen) {
        scr = track as LocalVideoTrack;
        continue;
      }

      if (track.kind === Track.Kind.Video) {
        {
          const id = pub.trackSid ?? track.sid ?? `local-${Math.random().toString(36).slice(2)}`;
          nextTiles.push({ id, track: track as LocalVideoTrack, isLocal: true });
        }
      }
    }

    // REMOTOS
    const remotesIter =
      room.remoteParticipants && typeof room.remoteParticipants.values === "function"
        ? room.remoteParticipants.values()
        : ([] as RemoteParticipant[]).values();

    for (const p of remotesIter) {
      const pubsIter =
        p?.trackPublications && typeof p.trackPublications.values === "function"
          ? p.trackPublications.values()
          : ([] as any[]).values();

      for (const pub of pubsIter as Iterable<TrackPublication>) {
        const track = pub?.track;
        if (!track) continue;

        const isScreen =
          (pub as any).source === (Track as any).Source?.ScreenShare ||
          (track as any).source === (Track as any).Source?.ScreenShare;

        if (isScreen) {
          scr = track as RemoteVideoTrack;
          continue;
        }

        if (track.kind === Track.Kind.Video) {
          {
            const id = pub.trackSid ?? track.sid ?? `${p.identity}-${Math.random().toString(36).slice(2)}`;
            nextTiles.push({ id, track: track as RemoteVideoTrack, isLocal: false });
          }
        }
        if (track.kind === Track.Kind.Audio) {
          nextAudios.add(track as RemoteAudioTrack);
        }
      }
    }

    setScreenTrack(scr);
    const uniq = new Map<string, { id: string; track: LocalVideoTrack | RemoteVideoTrack; isLocal: boolean }>();
    nextTiles.forEach((t) => uniq.set(getTrackKey(t.track), t));
    setVideoTiles(Array.from(uniq.values()));
    setAudioTracks(Array.from(nextAudios));

    // definir tile principal quando não há apresentação (preferir local)
    if (!scr) {
      const localFirst = nextTiles.find((t) => t.isLocal)?.id || nextTiles[0]?.id || null;
      setPrimaryId(localFirst ?? null);
    } else {
      setPrimaryId(null);
    }

    const onSubscribed = (track: Track, pub: TrackPublication) => {
      if (!pub || !track) return;

      const isScreen =
        (pub as any).source === (Track as any).Source?.ScreenShare ||
        (track as any).source === (Track as any).Source?.ScreenShare;

      if (isScreen) {
        setScreenTrack(track as LocalVideoTrack | RemoteVideoTrack);
        return;
      }

      if (track.kind === Track.Kind.Video) {
        const id = pub.trackSid ?? track.sid ?? Math.random().toString(36).slice(2);
        const key = getTrackKey(track);
        setVideoTiles((prev) => (prev.some((t) => getTrackKey(t.track) === key) ? prev : [...prev, { id, track: track as RemoteVideoTrack, isLocal: false }]));
      } else if (track.kind === Track.Kind.Audio) {
        const rtrack = track as RemoteAudioTrack;
        setAudioTracks((old) => Array.from(new Set([...old, rtrack])));
        if (audioEnabledRef.current && !audioElsRef.current.has(rtrack)) {
          const el = document.createElement("audio");
          rtrack.attach(el);
          el.autoplay = true;
          el.play().catch(() => {});
          audioElsRef.current.set(rtrack, el);
        }
      }
    };

    const onUnsubscribed = (track: Track, pub: TrackPublication) => {
      if (!pub || !track) return;
      const id = pub.trackSid ?? track.sid ?? "";

      const isScreen =
        (pub as any).source === (Track as any).Source?.ScreenShare ||
        (track as any).source === (Track as any).Source?.ScreenShare;

      if (isScreen) {
        setScreenTrack((cur) => (cur === track ? null : cur));
        return;
      }

      if (track.kind === Track.Kind.Video) {
        setVideoTiles((prev) => {
          const key = getTrackKey(track);
          const next = prev.filter((t) => getTrackKey(t.track) !== key);
          setPrimaryId((cur) => (cur === id ? (next.find((t) => t.isLocal)?.id || next[0]?.id || null) : cur));
          return next;
        });
      } else if (track.kind === Track.Kind.Audio) {
        const rtrack = track as RemoteAudioTrack;
        const el = audioElsRef.current.get(rtrack);
        if (el) {
          try {
            rtrack.detach(el);
          } catch {}
          el.remove();
          audioElsRef.current.delete(rtrack);
        }
        setAudioTracks((old) => old.filter((t) => t !== rtrack));
      }
    };

    const onActive = (speakers: any[]) => {
      if (scr) return; // se entrou apresentação, ignorar
      for (const p of speakers || []) {
        try {
          const pubsIter =
            p?.trackPublications && typeof p.trackPublications.values === "function"
              ? p.trackPublications.values()
              : ([] as any[]).values();
          for (const pub of pubsIter as Iterable<TrackPublication>) {
            const isScreen = (pub as any).source === (Track as any).Source?.ScreenShare;
            const vkind = (pub as any)?.track?.kind === Track.Kind.Video;
            const tid = (pub as any)?.trackSid || (pub as any)?.track?.sid || null;
            if (!isScreen && vkind && tid) {
              setPrimaryId(tid);
              return;
            }
          }
        } catch {}
      }
    };

    const onLocalPublished = (pub: TrackPublication) => {
      const track = pub?.track;
      if (!pub || !track) {
        // alguns navegadores/setups disparam o evento antes de anexar a track
        // tenta novamente no próximo tick
        setTimeout(() => {
          const t = pub?.track as LocalVideoTrack | undefined;
          if (!t) return;
          if (t.kind === Track.Kind.Video) {
            const id = pub.trackSid ?? t.sid ?? `local-${Math.random().toString(36).slice(2)}`;
            const key = getTrackKey(t as any);
            setVideoTiles((prev) => (prev.some((x) => getTrackKey(x.track) === key) ? prev : [...prev, { id, track: t, isLocal: true }]));
            setPrimaryId((cur) => cur ?? id);
          }
        }, 0);
        return;
      }

      const isScreen =
        (pub as any).source === (Track as any).Source?.ScreenShare ||
        (track as any).source === (Track as any).Source?.ScreenShare;

      if (isScreen) {
        setScreenTrack(track as LocalVideoTrack);
        return;
      }

      if (track.kind === Track.Kind.Video) {
        const id = pub.trackSid ?? track.sid ?? `local-${Math.random().toString(36).slice(2)}`;
        const key = getTrackKey(track);
        setVideoTiles((prev) => (prev.some((t) => getTrackKey(t.track) === key) ? prev : [...prev, { id, track: track as LocalVideoTrack, isLocal: true }]));
        setPrimaryId((cur) => cur ?? id);
      }
    };

    const onLocalUnpublished = (pub: TrackPublication) => {
      const track = pub?.track;
      if (!pub || !track) return;
      const id = pub.trackSid ?? track.sid ?? "";

      const isScreen =
        (pub as any).source === (Track as any).Source?.ScreenShare ||
        (track as any).source === (Track as any).Source?.ScreenShare;

      if (isScreen) {
        setScreenTrack((cur) => (cur === track ? null : cur));
        return;
      }

      if (track.kind === Track.Kind.Video) {
        setVideoTiles((prev) => {
          const next = id ? prev.filter((t) => t.id !== id) : prev;
          setPrimaryId((cur) => (cur === id ? (next.find((t) => t.isLocal)?.id || next[0]?.id || null) : cur));
          return next;
        });
      }
    };

    room
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.ActiveSpeakersChanged, onActive)
      .on(RoomEvent.LocalTrackPublished, onLocalPublished)
      .on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);

    // também escuta eventos no próprio localParticipant (alguns ambientes emitem aqui)
    try {
      room.localParticipant?.
        on?.(ParticipantEvent.TrackPublished as any, onLocalPublished as any);
      room.localParticipant?.
        on?.(ParticipantEvent.TrackUnpublished as any, onLocalUnpublished as any);
    } catch {}

    return () => {
      room
        .off(RoomEvent.TrackSubscribed, onSubscribed)
        .off(RoomEvent.TrackUnsubscribed, onUnsubscribed)
        .off(RoomEvent.ActiveSpeakersChanged, onActive)
        .off(RoomEvent.LocalTrackPublished, onLocalPublished)
        .off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
      try {
        room.localParticipant?.off?.(ParticipantEvent.TrackPublished as any, onLocalPublished as any);
        room.localParticipant?.off?.(ParticipantEvent.TrackUnpublished as any, onLocalUnpublished as any);
      } catch {}
      try {
        nextTiles.forEach((t) => t.track.detach());
        scr && (scr as any).detach?.();
        Array.from(nextAudios).forEach((t) => t.detach());
        for (const [t, el] of audioElsRef.current) {
          try {
            t.detach(el);
          } catch {}
          el.remove();
        }
        audioElsRef.current.clear();
      } catch {}
    };
  }, [roomRef, connState]);

  // attach apresentação (lado esquerdo grande)
  useEffect(() => {
    const root = screenRef.current;
    if (!root) return;
    root.innerHTML = "";
    if (!screenTrack) return;

    const el = document.createElement("video");
    el.className = "max-w-full max-h-full w-auto h-auto aspect-video object-contain rounded-xl";
    el.playsInline = true;
    el.autoplay = true;
    el.muted = true;
    root.appendChild(el);
    screenTrack.attach(el);
    try {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      el.play();
    } catch {}

    return () => {
      try {
        screenTrack.detach(el);
      } catch {}
      el.remove();
    };
  }, [screenTrack]);

  // attach tile principal quando não há apresentação
  useEffect(() => {
    const root = primaryRef.current;
    if (!root) return;
    if (screenTrack) return;

    // preferir tile por id; se não existir ainda, usar fallback direto do LiveKit
    const chosenId = primaryId ?? videoTiles[0]?.id ?? null;
    let tile = chosenId ? videoTiles.find((t) => t.id === chosenId) : undefined;

    if (!tile && roomRef.current) {
      const room = roomRef.current;
      try {
        const localVideoMap = (room.localParticipant as any)?.videoTracks as Map<any, any> | undefined;
        const camPub = localVideoMap?.get?.((Track as any).Source?.Camera);
        const vtrack = camPub?.track as LocalVideoTrack | undefined;
        if (vtrack) {
          tile = { id: camPub?.trackSid ?? vtrack.sid ?? "local-fallback", track: vtrack, isLocal: true };
        }
      } catch {}
    }

    if (!tile && roomRef.current) {
      const room = roomRef.current;
      try {
        const remotesIter =
          room.remoteParticipants && typeof room.remoteParticipants.values === "function"
            ? room.remoteParticipants.values()
            : ([] as RemoteParticipant[]).values();
        for (const p of remotesIter) {
          const pubsIter =
            p?.trackPublications && typeof p.trackPublications.values === "function"
              ? p.trackPublications.values()
              : ([] as any[]).values();
          for (const pub of pubsIter as Iterable<TrackPublication>) {
            const track = (pub as any)?.track as Track | undefined;
            const isScreen =
              (pub as any).source === (Track as any).Source?.ScreenShare ||
              (track as any)?.source === (Track as any).Source?.ScreenShare;
            if (track?.kind === Track.Kind.Video && !isScreen) {
              tile = {
                id: (pub as any)?.trackSid ?? (track as any)?.sid ?? `${p.identity}-fallback`,
                track: track as RemoteVideoTrack,
                isLocal: false,
              };
              break;
            }
          }
          if (tile) break;
        }
      } catch {}
    }

    // quando não há vídeo, desenha um placeholder com avatar/ iniciais
    // helper: renderiza placeholder com avatar/nome
    const renderPlaceholder = (displayName?: string) => {
      root.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "w-full h-full grid place-items-center rounded-xl";
      // Fundo diferenciado do page: paleta azul/ardósia suave
      wrap.style.background =
        "linear-gradient(135deg, #111827 0%, #0f172a 100%), " +
        "radial-gradient(800px 300px at 20% 10%, rgba(79,70,229,0.12), transparent 40%), " +
        "radial-gradient(600px 260px at 80% 85%, rgba(14,165,233,0.12), transparent 40%)";

      const avatar = document.createElement("div");
      avatar.className = "flex flex-col items-center";

      const imgUrl = (typeof window !== "undefined" && (localStorage.getItem("avatarUrl") || new URLSearchParams(window.location.search).get("avatar") || "")) as string;
      const nameLS = (typeof window !== "undefined" && (localStorage.getItem("displayName") || new URLSearchParams(window.location.search).get("name") || "")) as string;
      const name = displayName || nameLS || "Câmera desligada";
      const initials = (name || "Você").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

      if (imgUrl) {
        const img = document.createElement("img");
        img.src = imgUrl;
        img.alt = initials || "avatar";
        img.className = "h-28 w-28 rounded-full object-cover ring-2 ring-white/20 shadow";
        avatar.appendChild(img);
      } else {
        // Bolha com ícone de pessoa (monocromático), para indicar presença
        const bubble = document.createElement("div");
        bubble.className = "h-28 w-28 rounded-full grid place-items-center bg-white/10 ring-2 ring-white/20 shadow text-white";
        bubble.innerHTML = `
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" />
            <path d="M4 20a8 8 0 0116 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        `;
        avatar.appendChild(bubble);
      }

      const label = document.createElement("div");
      label.className = "mt-3 text-white/80 text-sm";
      label.textContent = name;
      avatar.appendChild(label);

      wrap.appendChild(avatar);
      root.appendChild(wrap);
      return () => wrap.remove();
    };

    if (!tile) {
      root.innerHTML = "";
      const room = roomRef.current;
      const displayName = room?.localParticipant?.name || room?.localParticipant?.identity || undefined;
      return renderPlaceholder(displayName);
    }

    // caso tenha tile mas a track esteja inativa (ended/muted), mostrar placeholder
    const mst = (tile.track as any)?.mediaStreamTrack;
    const ready = mst?.readyState;
    const enabled = mst?.enabled;
    const muted = (tile.track as any)?.muted || (tile.track as any)?.isMuted;
    const isLocalOff = tile.isLocal && !(roomRef.current?.localParticipant as any)?.isCameraEnabled;
    const inactive = isLocalOff || (ready && ready !== "live") || enabled === false || muted === true;
    if (inactive) {
      const room = roomRef.current;
      const displayName = tile.isLocal
        ? (room?.localParticipant?.name || room?.localParticipant?.identity)
        : undefined;
      return renderPlaceholder(displayName);
    }

    root.innerHTML = "";
    const el = document.createElement("video");
    el.className = "max-w-full max-h-full w-auto h-auto aspect-video object-contain rounded-xl";
    el.playsInline = true;
    el.autoplay = true;
    el.muted = true;
    root.appendChild(el);
    tile.track.attach(el);
    try {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      el.play();
    } catch {}

    return () => {
      try {
        (tile!.track as any)?.detach?.(el);
      } catch {}
      el.remove();
    };
  }, [primaryId, screenTrack, videoTiles, camOn]);

  // attach câmeras (filmstrip)
  useEffect(() => {
    const container = gridRef.current;
    if (!container) return;

    const primaryOrFirst = primaryId ?? videoTiles[0]?.id ?? null;
    const tilesToRender = screenTrack ? videoTiles : videoTiles.filter((t) => t.id !== primaryOrFirst);

    const valid = new Set(tilesToRender.map((t) => t.id));
    // limpar elementos que saíram (vídeos e placeholders)
    container.querySelectorAll<HTMLElement>("[data-pubsid]").forEach((el) => {
      if (!valid.has((el as any).dataset.pubsid!)) {
        if (el.tagName.toLowerCase() === "video") {
          try { (el as HTMLVideoElement).pause(); } catch {}
        }
        el.remove();
      }
    });

    tilesToRender.forEach((tile) => {
    const mst: any = (tile as any)?.track?.mediaStreamTrack;
    const isLocalOff = tile.isLocal && !(roomRef.current?.localParticipant as any)?.isCameraEnabled;
    const isActive = !isLocalOff && !!mst && mst.readyState === "live" && mst.enabled !== false && !(tile as any)?.track?.muted;

      const phSel = `div[data-ph-pubsid="${tile.id}"]`;
      const vidSel = `video[data-pubsid="${tile.id}"]`;
      const existingPh = container.querySelector<HTMLDivElement>(phSel);
      const existingVideo = container.querySelector<HTMLVideoElement>(vidSel);

      if (!isActive) {
        if (existingVideo) {
          try { tile.track.detach(existingVideo); } catch {}
          existingVideo.remove();
        }
        if (!existingPh) {
          const ph = document.createElement("div");
          ph.dataset.pubsid = tile.id;
          ph.setAttribute("data-ph-pubsid", tile.id);
          ph.className = "w-full aspect-video rounded-xl grid place-items-center";
          ph.style.background =
            "linear-gradient(135deg, #111827 0%, #0f172a 100%), " +
            "radial-gradient(680px 260px at 18% 12%, rgba(79,70,229,0.12), transparent 42%), " +
            "radial-gradient(560px 240px at 82% 88%, rgba(14,165,233,0.12), transparent 42%)";
          const bubble = document.createElement("div");
          bubble.className = "h-14 w-14 rounded-full grid place-items-center bg-white/10 ring-2 ring-white/20 shadow text-white";
          bubble.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" />
              <path d="M4 20a8 8 0 0116 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          `;
          // wrap com etiqueta
          const wrap = document.createElement("div");
          wrap.className = "flex flex-col items-center";
          wrap.appendChild(bubble);
          try {
            const room = roomRef.current;
            let pname = "Participante";
            if (tile.isLocal) {
              pname = (room?.localParticipant as any)?.name || (room?.localParticipant as any)?.identity || "Você";
            } else if (room) {
              const remotesIter = room.remoteParticipants && typeof room.remoteParticipants.values === "function"
                ? room.remoteParticipants.values()
                : ([] as any[]).values();
              let found = false;
              for (const p of remotesIter as any) {
                const pubsIter = p?.trackPublications && typeof p.trackPublications.values === "function"
                  ? p.trackPublications.values()
                  : ([] as any[]).values();
                for (const pub of pubsIter as any) {
                  const tid = (pub as any)?.trackSid || (pub as any)?.track?.sid;
                  const sid = (tile as any)?.track?.sid;
                  if (tid && (tid === tile.id || (sid && tid === sid))) { pname = p?.name || p?.identity || pname; found = true; break; }
                }
                if (found) break;
              }
            }
            const label = document.createElement("div");
            label.className = "mt-1 text-white/80 text-[11px] px-2 py-0.5 rounded-full bg-black/20";
            label.textContent = String(pname);
            wrap.appendChild(label);
          } catch {}
          ph.appendChild(wrap);
          container.appendChild(ph);
        }
        return;
      }

      if (existingPh) existingPh.remove();
      let el = existingVideo;
      if (!el) {
        el = document.createElement("video");
        el.dataset.pubsid = tile.id;
        el.className = "w-full aspect-video object-contain rounded-xl";
        el.playsInline = true;
        el.muted = true;
        el.autoplay = true;
        container.appendChild(el);
      } else {
        try { tile.track.detach(el); } catch {}
        el.className = "w-full aspect-video object-contain rounded-xl";
      }
      tile.track.attach(el);
      try { el.play(); } catch {}
    });
  }, [videoTiles, primaryId, screenTrack, camOn]);

  // Responsividade da filmstrip: ajustar largura para caber verticalmente
  useEffect(() => {
    const fs = gridRef.current;
    if (!fs) return;
    const gap = 12; // gap-3
    const minW = 220;
    const maxW = 360;
    const aspect = 9 / 16; // h = w * 9/16

    const totalH = fs.clientHeight || fs.getBoundingClientRect().height || 0;
    const primaryOrFirst = primaryId ?? videoTiles[0]?.id ?? null;
    const count = screenTrack ? videoTiles.length : videoTiles.filter((t) => t.id !== primaryOrFirst).length;
    if (!count || !totalH) return;

    const widthMaxByHeight = ((totalH - (count - 1) * gap) / count) / aspect;
    const width = Math.max(minW, Math.min(maxW, Math.floor(widthMaxByHeight)));
    if (Number.isFinite(width)) setFilmstripW(width);
  }, [videoTiles, primaryId, screenTrack]);

  const enableAudio = () => {
    audioTracks.forEach((t) => {
      if (audioElsRef.current.has(t)) return;
      const el = document.createElement("audio");
      t.attach(el);
      el.autoplay = true;
      el.play().catch(() => {});
      audioElsRef.current.set(t, el);
    });
    setAudioEnabled(true);
  };

  // PLACEHOLDERS quando ainda não está live
  if (showPlaceholders) {
    return (
      <div className="flex flex-col w-full h-full min-h-0 min-w-0 px-2 pt-2 pb-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="text-xs sm:text-sm text-slate-300">Aguardando conexão…</div>
        </div>
        <div className="flex gap-3 flex-grow min-h-0 min-w-0 overflow-hidden">
          <div className="flex-1 rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/5 min-h-0 min-w-0" />
          <div className="w-[260px] md:w-[300px] shrink-0 flex flex-col gap-3 min-h-0 min-w-0 overflow-y-auto pr-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-full aspect-video rounded-xl bg-white/5 ring-1 ring-white/10 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // LIVE
  if (!roomRef.current) {
    return <div className="w-full h-full grid place-items-center text-slate-300">Preparando sala…</div>;
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0 min-w-0 px-2 pt-2 pb-0 overflow-hidden">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="text-xs sm:text-sm text-slate-300">
          Conectado • {videoTiles.length} vídeo(s)
          {screenTrack ? " • Apresentando" : ""}
        </div>
        {!audioEnabled && audioTracks.length > 0 && (
          <button onClick={enableAudio} className="rounded-md px-2.5 py-1.5 text-xs bg-white/10 hover:bg-white/15 ring-1 ring-white/10">
            Habilitar áudio remoto
          </button>
        )}
      </div>

      {(() => {
        const primaryOrFirst = primaryId ?? videoTiles[0]?.id ?? null;
        const filmstripTiles = screenTrack ? videoTiles : videoTiles.filter((t) => t.id !== primaryOrFirst);
        const hasFilmstrip = filmstripTiles.length > 0;

        return screenTrack ? (
          <div className="flex justify-center gap-3 flex-grow min-h-0 min-w-0 overflow-hidden">
          <div
            ref={screenRef}
            className="w-full max-w-[1600px] mx-auto grid place-items-center rounded-xl overflow-hidden bg-black min-h-0 min-w-0"
            style={{ height: "100%" }}
          />
            <div
              ref={gridRef}
              className="shrink-0 flex flex-col gap-3 min-h-0 min-w-0 overflow-y-auto"
              style={{ width: filmstripW }}
            />
          </div>
        ) : (
          <div className="flex justify-center gap-3 flex-grow min-h-0 min-w-0 overflow-hidden">
            <div
              ref={primaryRef}
              className="w-full max-w-[1600px] mx-auto grid place-items-center rounded-xl overflow-hidden bg-black min-h-0 min-w-0"
              style={{ height: "100%" }}
            />
            {hasFilmstrip ? (
              <div
                ref={gridRef}
                className="shrink-0 flex flex-col gap-3 min-h-0 min-w-0 overflow-y-auto"
                style={{ width: filmstripW }}
              />
            ) : null}
          </div>
        );
      })()}
    </div>
  );
}

/* Sidebar (placeholder) */
function SidebarPanels({
  panel,
  recording,
  recordings,
  recError,
  onStartRecording,
  onStopRecording,
  driveHref,
}: {
  panel: PanelKey;
  recording?: boolean;
  recordings?: { url: string; size: number; startedAt: number }[];
  recError?: string;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  driveHref?: string;
}) {
  const title: Record<PanelKey, string> = {
    people: "Pessoas",
    chat: "Chat",
    tools: "Atividades",
    host: "Controles do anfitrião",
  };
  if (panel !== "tools") {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-white/10 shrink-0">
          <div className="text-base font-medium">{title[panel]}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm opacity-80">
          <p>Conteúdo do painel “{title[panel]}”.</p>
        </div>
      </div>
    );
  }

  // Tools panel (mais claro)
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-black/10 shrink-0">
        <div className="text-base font-medium">Ferramentas da reunião</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm">
        <div className="flex gap-4 border-b border-black/10 mb-3">
          <button className="text-blue-600 font-medium pb-2 border-b-2 border-blue-600">Ferramentas</button>
          <button className="text-black/50 pb-2">Complementos</button>
        </div>

        {/* Timer (placeholder) */}
        <div className="rounded-2xl bg-black/5 p-3 mb-3">
          <div className="font-medium">Timer</div>
          <div className="text-black/60 text-xs">Mostrar um timer de contagem…</div>
        </div>

        <div className="text-black/60 text-xs mb-2">Indisponível ou Premium</div>
        <a className="block text-blue-600 text-xs mb-3" href="#" onClick={(e) => e.preventDefault()}>Saiba mais sobre nossas ferramentas premium…</a>

        {/* Gravação */}
        <div className={"rounded-2xl p-3 mb-3 " + (recording ? "bg-red-50" : "bg-black/5") }>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Gravar</div>
              <div className="text-black/60 text-xs">Grave a reunião (gravação local .webm)</div>
            </div>
            {!recording ? (
              <button className="px-3 py-1.5 rounded-full bg-blue-600 text-white" onClick={onStartRecording}>Iniciar</button>
            ) : (
              <button className="px-3 py-1.5 rounded-full bg-red-600 text-white" onClick={onStopRecording}>Parar</button>
            )}
          </div>
          {driveHref ? (
            <div className="mt-2 text-xs">
              <a className="text-blue-600" href={driveHref}>Abrir Drive</a>
            </div>
          ) : null}
          {recError ? <div className="text-xs text-red-600 mt-2">{recError}</div> : null}
          {recordings && recordings.length > 0 && (
            <div className="mt-3 space-y-2">
              {recordings.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div>Gravação {i + 1} • {(r.size / (1024 * 1024)).toFixed(1)} MB</div>
                  <a href={r.url} download={`gravacao-${r.startedAt}.webm`} className="text-blue-600">Baixar</a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Demais itens desabilitados (placeholders) */}
        {[
          { t: "Transcrever", d: "Capturar a conversa" },
          { t: "Transmissão ao vivo", d: "Transmitir para usuários…" },
          { t: "Salas temáticas", d: "Dividir em grupos menores" },
          { t: "Enquetes", d: "Enviar enquetes ao público" },
          { t: "Perg & Resp", d: "Faça e responda a perguntas" },
        ].map((it, i) => (
          <div key={i} className="rounded-2xl p-3 mb-3 bg-black/5 opacity-60">
            <div className="font-medium">{it.t}</div>
            <div className="text-black/60 text-xs">{it.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =======================================================
   BottomBar — mantém seu layout visual original
======================================================= */

type MediaDev = { deviceId: string; label: string };

function BottomBar({
  roomCode,
  absoluteRoomUrl,
  participantsCount,
  unreadChat,
  micOn,
  camOn,
  screenOn,
  captionsOn,
  handRaised,
  activePanel,
  micDevices = [],
  camDevices = [],
  onMic,
  onCam,
  onScreen,
  onCaptions,
  onRaiseHand,
  onSelectMicDevice,
  onSelectCamDevice,
  onMore,
  onCaretUp,
  onHangup,
  onOpenPanel,
  onSelectViewMode,
  onChangeGridMax,
  onToggleHideNoVideo,
}: {
  roomCode: string;
  absoluteRoomUrl: string;
  participantsCount: number;
  unreadChat: number;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
  captionsOn: boolean;
  handRaised: boolean;
  activePanel: PanelKey | null;
  micDevices?: MediaDev[];
  camDevices?: MediaDev[];
  onMic: () => void;
  onCam: () => void;
  onScreen: () => void;
  onCaptions: () => void;
  onRaiseHand: () => void;
  onSelectMicDevice: (id: string) => void;
  onSelectCamDevice: (id: string) => void;
  onMore: () => void;
  onCaretUp: () => void;
  onHangup: () => void;
  onOpenPanel: (p: PanelKey | null) => void;
  onSelectViewMode: (m: "auto" | "mosaic" | "spotlight" | "sidebar") => void;
  onChangeGridMax: (n: number) => void;
  onToggleHideNoVideo: () => void;
}) {
  const [time, setTime] = useState("");
  const [openMore, setOpenMore] = useState(false);
  const [openView, setOpenView] = useState(false);
  const moreBtnRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });
  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!openMore) return;
    const r = moreBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenuPos({ left: r.left + r.width / 2, bottom: window.innerHeight - r.top + 10 });
  }, [openMore]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(absoluteRoomUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = absoluteRoomUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return (
    <div
      className="w-full bg-[#111] text-white border-t border-white/10"
      role="contentinfo"
      data-non-displace-bar
    >
      <div className="px-4 py-2 flex items-center justify-between gap-4" role="toolbar" aria-label="Controles da reunião">
        {/* LEFT */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-sm text-white/90 tabular-nums" suppressHydrationWarning>
            {time || "– – : – –"}
          </div>
          <div className="text-sm text-white/70">|</div>
          <div className="text-sm font-mono text-white/90">{roomCode}</div>

          <button
            type="button"
            className="ml-2 inline-grid place-items-center h-8 w-8 rounded-full hover:bg-white/10"
            title="Copiar link da reunião"
            onClick={copyLink}
            aria-label="Copiar link da reunião"
          >
            <IconInfo />
          </button>
        </div>

        {/* CENTER */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2">
            <CircleBtn title="Mais opções rápidas" onClick={onCaretUp}>
              <IconCaretUp />
            </CircleBtn>

            <TogglePill
              titleOn="Microfone ligado"
              titleOff="Microfone desligado"
              active={micOn}
              onToggle={onMic}
              menuTitle="Microfones"
              options={micDevices}
              onSelect={onSelectMicDevice}
              icon={<IconMic active={micOn} />}
            />

            <TogglePill
              titleOn="Câmera ligada"
              titleOff="Câmera desligada"
              active={camOn}
              onToggle={onCam}
              menuTitle="Câmeras"
              options={camDevices}
              onSelect={onSelectCamDevice}
              icon={<IconCamera active={camOn} />}
            />

            <CircleBtn title={screenOn ? "Parar apresentação" : "Apresentar agora"} active={screenOn} onClick={onScreen}>
              <IconScreen active={screenOn} />
            </CircleBtn>

            <CircleBtn title="Reações">
              <IconEmoji />
            </CircleBtn>

            <CircleBtn title="Legendas" active={captionsOn} onClick={onCaptions}>
              <IconCC active={captionsOn} />
            </CircleBtn>

            <CircleBtn title="Levantar mão" active={handRaised} onClick={onRaiseHand}>
              <IconHand active={handRaised} />
            </CircleBtn>

            <div ref={moreBtnRef} className="relative">
              <CircleBtn title="Mais" onClick={() => setOpenMore((v) => !v)}>
                <IconMore />
              </CircleBtn>
            </div>

            <button
              type="button"
              className="ml-1 h-10 px-4 rounded-full bg-[#EA4335] hover:bg-[#e0483b] font-medium"
              title="Sair da reunião"
              onClick={onHangup}
            >
              <div className="flex items-center gap-2">
                <IconHang />
                <span>Encerrar</span>
              </div>
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-1 shrink-0">
          <SideBtn title="Pessoas" active={activePanel === "people"} onClick={() => onOpenPanel(activePanel === "people" ? null : "people")}>
            <IconPeople />
            {participantsCount > 0 && <span className="ml-1 text-[10px] bg-white/20 rounded-full px-1.5">{participantsCount}</span>}
          </SideBtn>

          <SideBtn title="Chat" active={activePanel === "chat"} onClick={() => onOpenPanel(activePanel === "chat" ? null : "chat")}>
            <IconChat />
            {unreadChat > 0 && <span className="ml-1 text-[10px] bg-white/20 rounded-full px-1.5">{unreadChat}</span>}
          </SideBtn>

          <SideBtn title="Atividades" active={activePanel === "tools"} onClick={() => onOpenPanel(activePanel === "tools" ? null : "tools")}>
            <IconApps />
          </SideBtn>

          <SideBtn title="Controles do anfitrião" active={activePanel === "host"} onClick={() => onOpenPanel(activePanel === "host" ? null : "host")}>
            <IconLock />
          </SideBtn>
        </div>
      </div>

      {/* Menu "Mais" */}
      {openMore && (
        <div
          className="fixed z-[70] w-72 rounded-xl bg-[#1a1a1a] ring-1 ring-white/10 p-2 text-sm shadow-lg"
          style={{ left: menuPos.left, bottom: menuPos.bottom, transform: "translateX(-50%)" }}
        >
          <div className="px-2 py-2 text-white/50 flex items-center gap-2">
            <span className="opacity-70">Gravação indisponível</span>
          </div>
          <div className="h-px bg-white/10 my-2" />
          <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded flex items-center gap-2" onClick={() => { setOpenMore(false); setOpenView(true); }}>
            <span>Ajuste a visualização</span>
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); } catch {} setOpenMore(false); }}>
            Tela cheia
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={async () => { try { const v = document.querySelector("main video") as any; await v?.requestPictureInPicture?.(); } catch {} setOpenMore(false); }}>
            Abrir picture‑in‑picture
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { setOpenMore(false); alert("Planos de fundo e efeitos: em breve"); }}>
            Planos de fundo e efeitos
          </button>
          <div className="h-px bg-white/10 my-2" />
          <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { setOpenMore(false); window.open("mailto:support@example.com?subject=Problema%20na%20reunião","_blank"); }}>
            Informar um problema
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { setOpenMore(false); }}>
            Denunciar abuso
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { setOpenMore(false); }}>
            Ajuda e solução de problemas
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { setOpenMore(false); }}>
            Configurações
          </button>
        </div>
      )}

      {/* Dialog "Ajuste a visualização" */}
      {openView && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenView(false)} />
          <div className="relative w-[380px] max-w-[92vw] rounded-2xl bg-[#1a1a1a] ring-1 ring-white/10 p-4 text-sm shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-white font-medium">Ajuste a visualização</div>
              <button className="h-8 w-8 grid place-items-center rounded hover:bg-white/10" onClick={() => setOpenView(false)} aria-label="Fechar">✕</button>
            </div>
            <div className="space-y-2 text-white/90">
              <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { onSelectViewMode("auto"); }}>
                Automático (dinâmico)
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { onSelectViewMode("mosaic"); }}>
                Mosaico (legado)
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { onSelectViewMode("spotlight"); }}>
                Destaque
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-white/10 rounded" onClick={() => { onSelectViewMode("sidebar"); }}>
                Barra lateral
              </button>
              <div className="mt-3 text-white/70">Blocos</div>
              <input type="range" min={4} max={16} step={1} defaultValue={9} className="w-full" onChange={(e) => onChangeGridMax(Number(e.currentTarget.value))} />
              <div className="mt-2 flex items-center gap-2">
                <input id="hide-novid" type="checkbox" className="h-4 w-4" onChange={() => onToggleHideNoVideo()} />
                <label htmlFor="hide-novid" className="text-white/90">Ocultar blocos sem vídeo</label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" onClick={() => setOpenView(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======= subcomponentes do BottomBar ======= */

function TogglePill({
  titleOn,
  titleOff,
  active,
  onToggle,
  menuTitle,
  options,
  onSelect,
  icon,
}: {
  titleOn: string;
  titleOff: string;
  active: boolean;
  onToggle: () => void;
  menuTitle: string;
  options: { deviceId: string; label: string }[];
  onSelect: (id: string) => void;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocMouse = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouse);
    document.addEventListener("keydown", onDocKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouse);
      document.removeEventListener("keydown", onDocKey);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-pressed={active}
        title={active ? titleOn : titleOff}
        onClick={onToggle}
        className={
          "h-10 px-4 rounded-full flex items-center gap-2 border " +
          (active ? "bg-white text-black border-white" : "bg-[#2a2a2a] text-white border-[#3a3a3a] hover:bg-[#3a3a3a]")
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        {icon}
        <span className="text-sm">{active ? titleOn.split(" ")[0] : titleOff.split(" ")[0]}</span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="ml-1 inline-grid place-items-center h-6 w-6 rounded-full bg-black/20 hover:bg-black/30"
          title={`Selecionar ${menuTitle.toLowerCase()}`}
          aria-label={`Selecionar ${menuTitle.toLowerCase()}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpen((v) => !v);
          }}
        >
          <IconChevron />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-56 rounded-lg bg-[#1a1a1a] ring-1 ring-white/10 p-2" role="menu" aria-label={menuTitle}>
          <div className="px-2 py-1 text-xs text-white/60">{menuTitle}</div>
          <div className="max-h-56 overflow-auto">
            {options.map((opt) => (
              <button
                type="button"
                key={opt.deviceId}
                className="w-full text-left text-sm px-2 py-1 rounded hover:bg-white/10"
                onClick={() => {
                  onSelect(opt.deviceId);
                  setOpen(false);
                }}
                role="menuitem"
              >
                {opt.label || "(Dispositivo)"}
              </button>
            ))}
            {options.length === 0 && <div className="px-2 py-2 text-sm text-white/50">Nenhum dispositivo</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function CircleBtn({ children, title, active, onClick }: { children: React.ReactNode; title?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      title={title}
      onClick={onClick}
      className={"h-10 w-10 rounded-full grid place-items-center border " + (active ? "bg-white text-black border-white" : "bg-[#2a2a2a] text-white border-[#3a3a3a] hover:bg-[#3a3a3a]")}
    >
      {children}
    </button>
  );
}

function SideBtn({ children, title, active, onClick }: { children: React.ReactNode; title?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      title={title}
      onClick={onClick}
      className={"h-10 px-3 rounded-full flex items-center border " + (active ? "bg-white text-black border-white" : "bg-transparent text-white border-transparent hover:bg-white/10")}
    >
      {children}
    </button>
  );
}

/* ======= ícones (SVG) ======= */
function IconInfo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v6m0-10h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconCaretUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function IconMic({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3a3 3 0 013 3v6a3 3 0 11-6 0V6a3 3 0 013-3z" stroke="currentColor" strokeWidth="2" />
      {!active && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      <path d="M5 12a7 7 0 0014 0" stroke="currentColor" strokeWidth="2" />
      <path d="M12 19v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconCamera({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M15 10l6-3v10l-6-3v-4z" stroke="currentColor" strokeWidth="2" />
      {!active && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}
function IconScreen({ active }: { active?: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {active && <circle cx="19" cy="7" r="2" fill="currentColor" />}
    </svg>
  );
}
function IconEmoji() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M9 10h.01M15 10h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 14c1 .8 2.3 1.2 4 1.2s3-.4 4-1.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconCC({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9.5 12a2 2 0 103.9 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {active && <rect x="3" y="7" width="18" height="10" rx="2" className="fill-white/10" />}
    </svg>
  );
}
function IconHand({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 11V6a1 1 0 012 0v5M11 11V5a1 1 0 012 0v6M15 11V7a1 1 0 012 0v4M19 12v-2a1 1 0 012 0v3a7 7 0 01-7 7h-2a7 7 0 01-7-7v-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {active && <circle cx="20" cy="6" r="2" fill="currentColor" />}
    </svg>
  );
}
function IconMore() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="18" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}
function IconHang() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M5 14c2.3-2 5-3 7-3s4.7 1 7 3l-1.5 3c-1.6-1.2-3.5-2-5.5-2s-3.9.8-5.5 2L5 14z" fill="currentColor" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3 20a6 6 0 0112 0" stroke="currentColor" strokeWidth="2" />
      <path d="M16 11a2 2 0 114 0M17 20a4 4 0 118 0" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 18l-3 3v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconApps() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10V8a4 4 0 118 0v2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
