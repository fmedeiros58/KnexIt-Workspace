"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlayerProps = {
  title: string;
  muxPlaybackId?: string;
  youtubeId?: string;
  vimeoId?: string;
  onPrev?: () => void;
  onNext?: () => void;
};

type SourceKind = "mux" | "youtube" | "vimeo" | "none";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    webkitRequestFullscreen?: any;
    mozRequestFullScreen?: any;
    msRequestFullscreen?: any;
  }
}

let ytScriptLoading: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!ytScriptLoading) {
    ytScriptLoading = new Promise<void>((resolve) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      if (!existing) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;
        document.body.appendChild(tag);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const check = () => {
        if (window.YT?.Player) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }
  return ytScriptLoading;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const fmt = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export default function Player({
  title,
  muxPlaybackId,
  youtubeId,
  vimeoId,
  onPrev,
  onNext,
}: PlayerProps) {
  const kind: SourceKind = useMemo(() => {
    if (muxPlaybackId) return "mux";
    if (youtubeId) return "youtube";
    if (vimeoId) return "vimeo";
    return "none";
  }, [muxPlaybackId, youtubeId, vimeoId]);

  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(0);

  const playerRootRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const html5VideoRef = useRef<HTMLVideoElement | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const vimeoRef = useRef<HTMLIFrameElement | null>(null);

  const storageKey = useMemo(() => {
    const id = muxPlaybackId || youtubeId || vimeoId || "none";
    const provider = kind;
    return `player:progress:${provider}:${id}`;
  }, [kind, muxPlaybackId, youtubeId, vimeoId]);

  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [showResume, setShowResume] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const sec = parseFloat(raw);
      if (!isNaN(sec) && sec > 5) {
        setResumeAt(sec);
        setShowResume(true);
      } else {
        setResumeAt(null);
        setShowResume(false);
      }
    } catch {}
  }, [storageKey]);

  /** ===== MUX (HTML5) ===== */
  useEffect(() => {
    if (kind !== "mux") return;
    const v = html5VideoRef.current;
    if (!v) return;

    const onTime = () => {
      try {
        setCurrentSec(v.currentTime || 0);
        setTotalSec(v.duration || 0);
        localStorage.setItem(storageKey, String(v.currentTime || 0));
      } catch {}
    };
    const onEnded = () => {
      try {
        localStorage.setItem(storageKey, String(0));
      } catch {}
      setPlaying(false);
      setCurrentSec(0);
      onNext?.();
    };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onTime);
    v.addEventListener("ended", onEnded);
    v.addEventListener("pause", onTime);
    v.addEventListener("play", () => setPlaying(true));
    v.addEventListener("pause", () => setPlaying(false));
    v.playbackRate = rate;

    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onTime);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("pause", onTime);
    };
  }, [kind, storageKey, onNext, rate]);

  useEffect(() => {
    if (kind !== "mux") return;
    const v = html5VideoRef.current;
    if (!v) return;
    v.playbackRate = rate;
  }, [kind, rate]);

  /** ===== YouTube ===== */
  useEffect(() => {
    if (kind !== "youtube" || !youtubeId) return;
    let destroyed = false;

    (async () => {
      await loadYouTubeAPI();
      if (destroyed) return;
      const container = ytContainerRef.current;
      if (!container) return;

      if (ytPlayerRef.current && ytPlayerRef.current.getIframe) return;
      if (container.childNodes.length > 0) return;

      ytPlayerRef.current = new window.YT.Player(container, {
        videoId: youtubeId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
        },
        events: {
          onReady: (e: any) => {
            try {
              setPlaying(false);
              const d = e?.target?.getDuration?.() ?? 0;
              if (Number.isFinite(d) && d > 0) setTotalSec(d);
            } catch {}
          },
          onStateChange: (e: any) => {
            if (e?.data === 1) setPlaying(true);
            if (e?.data === 2) setPlaying(false);
            if (e?.data === 0) {
              try {
                localStorage.setItem(storageKey, String(0));
              } catch {}
              onNext?.();
            }
          },
        },
      });
    })();

    return () => {
      destroyed = true;
      try {
        ytPlayerRef.current?.destroy();
        ytPlayerRef.current = null;
      } catch {}
    };
  }, [kind, youtubeId, onNext, storageKey]);

  useEffect(() => {
    if (kind === "youtube" && ytPlayerRef.current?.setPlaybackRate) {
      try {
        ytPlayerRef.current.setPlaybackRate(rate);
        const state = ytPlayerRef.current.getPlayerState?.();
        if (state === 1) ytPlayerRef.current.playVideo?.();
      } catch {}
    }
  }, [kind, rate]);

  useEffect(() => {
    if (kind !== "youtube") return;
    let timer: number | null = null;

    const start = () => {
      if (timer != null) return;
      timer = window.setInterval(() => {
        try {
          const cur = ytPlayerRef.current?.getCurrentTime?.() || 0;
          const dur = ytPlayerRef.current?.getDuration?.() || 0;
          setCurrentSec(cur);
          if (Number.isFinite(dur) && dur > 0) setTotalSec(dur);
          localStorage.setItem(storageKey, String(cur));
        } catch {}
      }, 500);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (playing) start();
    else stop();

    return () => stop();
  }, [kind, storageKey, playing]);

  /** ===== Vimeo (embed simples) ===== */
  const vimeoSrc = useMemo(() => {
    if (!vimeoId) return "";
    const params = new URLSearchParams({
      title: "0",
      byline: "0",
      portrait: "0",
      autopause: "1",
      autoplay: "0",
      transparent: "0",
      app_id: "122963",
    }).toString();
    return `https://player.vimeo.com/video/${vimeoId}?${params}`;
  }, [vimeoId]);

  /** ===== Controles ===== */
  const handlePlayPause = useCallback(() => {
    if (kind === "mux" && html5VideoRef.current) {
      const v = html5VideoRef.current;
      if (v.paused) {
        v.play();
        setPlaying(true);
      } else {
        v.pause();
        setPlaying(false);
      }
      return;
    }
    if (kind === "youtube" && ytPlayerRef.current) {
      const state = ytPlayerRef.current.getPlayerState?.();
      if (state === 1) {
        ytPlayerRef.current.pauseVideo();
        setPlaying(false);
      } else {
        ytPlayerRef.current.playVideo();
        setPlaying(true);
      }
      return;
    }
    if (kind === "vimeo") {
      try {
        vimeoRef.current?.contentWindow?.postMessage(
          JSON.stringify({ method: playing ? "pause" : "play" }),
          "*"
        );
        setPlaying((p) => !p);
      } catch {}
    }
  }, [kind, playing]);

  const seekRel = useCallback(
    (seconds: number) => {
      if (kind === "mux" && html5VideoRef.current) {
        html5VideoRef.current.currentTime = Math.max(
          0,
          html5VideoRef.current.currentTime + seconds
        );
        return;
      }
      if (kind === "youtube" && ytPlayerRef.current) {
        const cur = ytPlayerRef.current.getCurrentTime?.() || 0;
        ytPlayerRef.current.seekTo(cur + seconds, true);
        return;
      }
    },
    [kind]
  );

  const changeRate = useCallback(
    (newRate: number) => {
      setRate(newRate);
      if (kind === "mux" && html5VideoRef.current) {
        const v = html5VideoRef.current;
        v.playbackRate = newRate;
        if (!v.paused) v.play().catch(() => {});
        return;
      }
      if (kind === "youtube" && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.setPlaybackRate(newRate);
          const state = ytPlayerRef.current.getPlayerState?.();
          if (state !== 1) ytPlayerRef.current.playVideo?.();
        } catch {}
        return;
      }
    },
    [kind]
  );

  const handleResume = useCallback(() => {
    if (!resumeAt) return;
    if (kind === "mux" && html5VideoRef.current) {
      html5VideoRef.current.currentTime = resumeAt;
      html5VideoRef.current.play();
      setPlaying(true);
    } else if (kind === "youtube" && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(resumeAt, true);
      ytPlayerRef.current.playVideo();
      setPlaying(true);
    } else if (kind === "vimeo") {
      vimeoRef.current?.contentWindow?.postMessage(
        JSON.stringify({ method: "play" }),
        "*"
      );
      setPlaying(true);
    }
    setShowResume(false);
  }, [kind, resumeAt]);

  const onSeekAbsolute = useCallback(
    (val: number) => {
      const to = clamp(val, 0, totalSec || 0);
      if (kind === "mux" && html5VideoRef.current) {
        html5VideoRef.current.currentTime = to;
        setCurrentSec(to);
        return;
      }
      if (kind === "youtube" && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(to, true);
        setCurrentSec(to);
        return;
      }
    },
    [kind, totalSec]
  );

  /** ===== Fullscreen ===== */
  const enterFullscreen = useCallback(async () => {
    const el = playerRootRef.current as any;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } catch {}
  }, []);

  const exitFullscreen = useCallback(async () => {
    const doc: any = document;
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
      else if (doc.msExitFullscreen) doc.msExitFullscreen();
    } catch {}
  }, []);

  const [fsAnimating, setFsAnimating] = useState(false);
  const toggleFullscreen = useCallback(() => {
    setFsAnimating(true);
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
    setTimeout(() => setFsAnimating(false), 250);
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const onChange = () => {
      const fsEl =
        (document as any).fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement;
      setIsFullscreen(!!fsEl);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as any);
    document.addEventListener("mozfullscreenchange", onChange as any);
    document.addEventListener("MSFullscreenChange", onChange as any);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as any);
      document.removeEventListener("mozfullscreenchange", onChange as any);
      document.removeEventListener("MSFullscreenChange", onChange as any);
    };
  }, []);

  /** ===== Render do vídeo (estrutura muda no fullscreen) ===== */
  const videoSurface = (children: React.ReactNode) =>
    // superfície do vídeo
    <div className={isFullscreen ? "relative flex-1 bg-black" : "relative aspect-video rounded-xl overflow-hidden bg-black"}>
      {children}
    </div>;

  const renderVideo = () => {
    const common = "w-full h-full bg-black";
    if (kind === "mux" && muxPlaybackId) {
      return videoSurface(
        <>
          <video
            ref={html5VideoRef}
            className={common}
            controls={false}
            playsInline
            src={`https://stream.mux.com/${muxPlaybackId}.m3u8`}
          />
          {!playing && (
            <button
              onClick={handlePlayPause}
              className="absolute inset-0 grid place-items-center bg-black/40 hover:bg-black/30 transition"
              aria-label="Reproduzir"
              title="Reproduzir"
            >
              <span className="inline-grid w-16 h-16 place-items-center rounded-full bg-white/90 text-slate-900 text-lg">
                ▶
              </span>
            </button>
          )}
        </>
      );
    }

    if (kind === "youtube" && youtubeId) {
      return videoSurface(
        <>
          <div ref={ytContainerRef} className={common} />
          {!playing && (
            <button
              onClick={handlePlayPause}
              className="absolute inset-0 grid place-items-center bg-black/40 hover:bg-black/30 transition"
              aria-label="Reproduzir"
              title="Reproduzir"
            >
              <span className="inline-grid w-16 h-16 place-items-center rounded-full bg-white/90 text-slate-900 text-lg">
                ▶
              </span>
            </button>
          )}
        </>
      );
    }

    if (kind === "vimeo" && vimeoId) {
      return videoSurface(
        <>
          <iframe
            ref={vimeoRef}
            className={common}
            src={vimeoSrc}
            title={title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
          {!playing && (
            <button
              onClick={handlePlayPause}
              className="absolute inset-0 grid place-items-center bg-black/40 hover:bg-black/30 transition"
              aria-label="Reproduzir"
              title="Reproduzir"
            >
              <span className="inline-grid w-16 h-16 place-items-center rounded-full bg-white/90 text-slate-900 text-lg">
                ▶
              </span>
            </button>
          )}
        </>
      );
    }

    return (
      <div className="aspect-video grid place-items-center bg-slate-900 rounded-xl">
        <span className="text-slate-400">
          Informe <code>muxPlaybackId</code>, <code>youtubeId</code> ou{" "}
          <code>vimeoId</code>.
        </span>
      </div>
    );
  };

  const progress = totalSec > 0 ? (currentSec / totalSec) * 100 : 0;
  const rangeBgNormal = `linear-gradient(to right, #22c55e 0%, #22c55e ${progress}%, #e5e7eb ${progress}%, #e5e7eb 100%)`;
  const rates = [0.75, 1, 1.25, 1.5, 1.75, 2];

  /** ===== Markup ===== */
  return (
    <div
      ref={playerRootRef}
      className={
        isFullscreen
          ? // fullscreen: coluna → vídeo (flex-1) em cima, barra fixa embaixo
            "relative w-full h-full min-h-screen bg-black text-white flex flex-col"
          : "w-full"
      }
    >
      {!isFullscreen && <h2 className="text-xl font-semibold mb-4">{title}</h2>}

      {/* Área do vídeo */}
      {renderVideo()}

      {/* Barra de progresso + controles */}
      {isFullscreen ? (
        // ===== FULLSCREEN: rodapé fixo, não sobrepõe o vídeo =====
        <div className="shrink-0 p-3 md:p-4 bg-black/70 backdrop-blur">
          {/* tempo atual / total */}
          <div className="flex items-center justify-between text-[11px] md:text-xs text-white/85 mb-1">
            <span>{fmt(currentSec)}</span>
            <span>{fmt(totalSec)}</span>
          </div>

          {/* barra de progresso */}
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(totalSec || 0))}
            value={Math.floor(currentSec || 0)}
            onChange={(e) => onSeekAbsolute(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/20"
            style={{
              background: `linear-gradient(to right, #22c55e 0%, #22c55e ${progress}%, rgba(255,255,255,0.25) ${progress}%, rgba(255,255,255,0.25) 100%)`,
            }}
          />

          {/* Controles */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="btn btn-secondary !border-white/30 !text-white hover:!bg-white/15 focus-visible:!ring-white/40"
              onClick={onPrev}
              disabled={!onPrev}
              title="Aula anterior"
            >
              ← Anterior
            </button>

            <button
              className="btn btn-secondary !border-white/30 !text-white hover:!bg-white/15 focus-visible:!ring-white/40"
              onClick={() => seekRel(-10)}
              title="Voltar 10s"
            >
              ⟲ 10s
            </button>

            <button
              className="btn btn-primary !bg-indigo-500 hover:!bg-indigo-400"
              onClick={handlePlayPause}
              title={playing ? "Pausar" : "Reproduzir"}
            >
              {playing ? "Pause" : "Play"}
            </button>

            <button
              className="btn btn-secondary !border-white/30 !text-white hover:!bg-white/15 focus-visible:!ring-white/40"
              onClick={() => seekRel(10)}
              title="Avançar 10s"
            >
              10s ⟶
            </button>

            <div className="ml-2 inline-flex items-center gap-1">
              <span className="text-white/80 text-sm">Velocidade:</span>
              <div className="inline-flex rounded-xl overflow-hidden ring-1 ring-white/20">
                {rates.map((r) => (
                  <button
                    key={r}
                    onClick={() => changeRate(r)}
                    className={`px-2 py-1 text-sm ${
                      r === rate
                        ? "bg-indigo-500 text-white"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            <button
              className="btn btn-secondary !border-white/30 !text-white hover:!bg-white/15 focus-visible:!ring-white/40"
              onClick={toggleFullscreen}
              disabled={fsAnimating}
              title="Sair da tela inteira"
              aria-label="Sair da tela inteira"
            >
              {/* Ícone “sair de fullscreen” */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 14 4 14 4 9"></polyline>
                <polyline points="15 10 20 10 20 15"></polyline>
                <line x1="4" y1="20" x2="10" y2="14"></line>
                <line x1="20" y1="4" x2="14" y2="10"></line>
              </svg>
            </button>

            <button
              className="btn btn-secondary !border-white/30 !text-white hover:!bg-white/15 focus-visible:!ring-white/40"
              onClick={onNext}
              disabled={!onNext}
              title="Próxima aula"
            >
              Próxima →
            </button>
          </div>
        </div>
      ) : (
        // ===== MODO NORMAL: controles abaixo do vídeo =====
        <div className="mt-3">
          {/* banner continuar */}
          {showResume && resumeAt != null && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 text-amber-900 px-4 py-2 ring-1 ring-amber-200">
              <span className="text-sm">
                Você parou em <strong>{fmt(resumeAt)}</strong>.
              </span>
              <button onClick={handleResume} className="btn btn-primary btn-sm">
                Continuar daí
              </button>
              <button onClick={() => setShowResume(false)} className="btn btn-secondary btn-sm">
                Começar do início
              </button>
            </div>
          )}

          {/* tempos */}
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>{fmt(currentSec)}</span>
            <span>{fmt(totalSec)}</span>
          </div>

          {/* progresso */}
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(totalSec || 0))}
            value={Math.floor(currentSec || 0)}
            onChange={(e) => onSeekAbsolute(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200"
            style={{ background: rangeBgNormal }}
          />

          {/* botões */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" onClick={onPrev} disabled={!onPrev} title="Aula anterior">
              ← Anterior
            </button>

            <button className="btn btn-secondary" onClick={() => seekRel(-10)} title="Voltar 10s">
              ⟲ 10s
            </button>

            <button className="btn btn-primary" onClick={handlePlayPause} title={playing ? "Pausar" : "Reproduzir"}>
              {playing ? "Pause" : "Play"}
            </button>

            <button className="btn btn-secondary" onClick={() => seekRel(10)} title="Avançar 10s">
              10s ⟶
            </button>

            <div className="ml-2 inline-flex items-center gap-1">
              <span className="text-slate-400 text-sm">Velocidade:</span>
              <div className="inline-flex rounded-xl overflow-hidden ring-1 ring-white/10">
                {rates.map((r) => (
                  <button
                    key={r}
                    onClick={() => changeRate(r)}
                    className={`px-2 py-1 text-sm ${
                      r === rate ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            {/* entrar em tela cheia */}
            <button
              className="btn btn-secondary"
              onClick={toggleFullscreen}
              disabled={fsAnimating}
              title="Tela inteira"
              aria-label="Tela inteira"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>

            <button className="btn btn-secondary" onClick={onNext} disabled={!onNext} title="Próxima aula">
              Próxima →
            </button>
          </div>
        </div>
      )}

      {kind === "youtube" && !isFullscreen && (
        <p className="mt-2 text-xs text-slate-400">
          Observação: no YouTube, elementos de marca/anúncios podem aparecer por política da plataforma. Para player
          totalmente limpo, use <code>muxPlaybackId</code>.
        </p>
      )}
    </div>
  );
}


