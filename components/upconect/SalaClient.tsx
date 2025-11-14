// components/upconect/SalaClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  code: string;
  name?: string;
};

export default function SalaClient({ code, name }: Props) {
  const router = useRouter();

  // preview
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string | undefined>(undefined);
  const [micId, setMicId] = useState<string | undefined>(undefined);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  // caminho + link
  const roomPath = `/upconect/sala/${code}`;
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  const absoluteRoomUrl = useMemo(
    () => (isClient ? `${window.location.origin}${roomPath}` : roomPath),
    [isClient, roomPath]
  );

  // monta preview e lista devices
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camOn ? { deviceId: camId ? { exact: camId } : undefined } : false,
          audio: micOn ? { deviceId: micId ? { exact: micId } : undefined } : false,
        });
        if (canceled) return;

        setPreviewStream(stream);
        if (videoEl.current) {
          videoEl.current.srcObject = stream;
          await videoEl.current.play().catch(() => {});
        }

        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list);
      } catch (e) {
        console.error("preview error:", e);
      }
    })();

    return () => {
      canceled = true;
      setPreviewStream((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
      window.dispatchEvent(new Event("upconect:left"));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camId, micId, camOn, micOn]);

  const videoInputs = devices.filter((d) => d.kind === "videoinput");
  const audioInputs = devices.filter((d) => d.kind === "audioinput");

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

  const handleJoin = () => {
    // encerra preview local; o Layout assumirá
    setPreviewStream((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
    window.dispatchEvent(new Event("upconect:joined"));

    const url = new URL(roomPath, window.location.origin);
    url.searchParams.set("joined", "1");
    if (camId) url.searchParams.set("camId", camId);
    if (micId) url.searchParams.set("micId", micId);
    if (camOn) url.searchParams.set("camOn", "1");
    if (micOn) url.searchParams.set("micOn", "1");

    // navega para a mesma rota com flags
    router.replace(url.pathname + url.search);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-6 pt-4">
        <h1 className="text-lg font-semibold">
          {name ? (
            <>
              <span className="text-white/90">{name}</span>
              <span className="ml-2 text-white/60 font-normal">
                • sala <span className="font-mono">#{code}</span>
              </span>
            </>
          ) : (
            <>Sala <span className="font-mono">#{code}</span></>
          )}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Link: <span className="font-mono">{absoluteRoomUrl}</span>
          <button onClick={copyLink} className="ml-2 underline text-slate-300 hover:text-white">
            Copiar
          </button>
        </p>
      </div>

      <div className="px-6 mt-4">
        <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-zinc-950">
          <div className="grid md:grid-cols-[2fr_1fr] gap-6 p-6">
            {/* Preview */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden ring-1 ring-white/10 grid place-items-center">
              <video ref={videoEl} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!camOn && (
                <div className="absolute text-sm text-white/80 bg-black/50 px-2 py-1 rounded">
                  Câmera desligada
                </div>
              )}
            </div>

            {/* Controles */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Câmera</label>
                <select
                  value={camId ?? ""}
                  onChange={(e) => setCamId(e.target.value || undefined)}
                  className="w-full bg-black text-white ring-1 ring-white/10 rounded px-2 py-1"
                >
                  <option value="">Padrão do sistema</option>
                  {videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Câmera"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Microfone</label>
                <select
                  value={micId ?? ""}
                  onChange={(e) => setMicId(e.target.value || undefined)}
                  className="w-full bg-black text-white ring-1 ring-white/10 rounded px-2 py-1"
                >
                  <option value="">Padrão do sistema</option>
                  {audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Microfone"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMicOn((v) => !v)}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm bg-white/10 hover:bg-white/15 ring-1 ring-white/10"
                >
                  {micOn ? "Mutar microfone" : "Ligar microfone"}
                </button>
                <button
                  onClick={() => setCamOn((v) => !v)}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm bg-white/10 hover:bg-white/15 ring-1 ring-white/10"
                >
                  {camOn ? "Desligar câmera" : "Ligar câmera"}
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleJoin}
                  className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold bg-emerald-600 hover:bg-emerald-500"
                >
                  Entrar na reunião
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
