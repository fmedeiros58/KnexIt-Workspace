"use client";

import React, { useEffect, useState } from "react";
import { LiveKitRoom, useRoomContext } from "@livekit/components-react";
import BottomBar from "@/components/upconect/BottomBar";
import VideoArea from "@/components/upconect/VideoArea";

export default function SalaLayoutClient({
  code,
  children,
  panel,
}: {
  code: string;
  children: React.ReactNode;
  panel: React.ReactNode;
}) {
  // mídia
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);

  // entrou?
  const [inRoom, setInRoom] = useState(false);

  // token/url
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  // URL absoluta
  const roomPath = `/upconect/sala/${code}`;
  const [absoluteRoomUrl, setAbsoluteRoomUrl] = useState(roomPath);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setAbsoluteRoomUrl(`${window.location.origin}${roomPath}`);
    }
  }, [roomPath]);

  // ouvir join/leave do lobby interno
  useEffect(() => {
    const onJoined = () => setInRoom(true);
    const onLeft = () => setInRoom(false);
    window.addEventListener("upconect:joined", onJoined as EventListener);
    window.addEventListener("upconect:left", onLeft as EventListener);
    return () => {
      window.removeEventListener("upconect:joined", onJoined as EventListener);
      window.removeEventListener("upconect:left", onLeft as EventListener);
    };
  }, []);

  // buscar token ao entrar
  useEffect(() => {
    (async () => {
      if (!inRoom || token) return;
      try {
        const r = await fetch(`/api/livekit-token?room=${encodeURIComponent(code)}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Falha ao obter token");
        setToken(j.token);
        setServerUrl(j.url);
      } catch (e) {
        console.error(e);
        setInRoom(false);
      }
    })();
  }, [code, inRoom, token]);

  // controles da barra
  function Controls() {
    const room = useRoomContext();
    const toggleMic = () => {
      const n = !micOn; setMicOn(n);
      room?.localParticipant.setMicrophoneEnabled(n);
    };
    const toggleCam = () => {
      const n = !camOn; setCamOn(n);
      room?.localParticipant.setCameraEnabled(n);
    };
    const toggleScreen = async () => {
      const n = !screenOn; setScreenOn(n);
      try { await room?.localParticipant.setScreenShareEnabled(n); }
      catch { setScreenOn(!n); }
    };
    return (
      <div className="fixed inset-x-0 bottom-0 z-50">
        <BottomBar
          roomCode={code}
          absoluteRoomUrl={absoluteRoomUrl}
          micOn={micOn}
          camOn={camOn}
          screenOn={screenOn}
          onMic={toggleMic}
          onCam={toggleCam}
          onScreen={toggleScreen}
          activePanel={null}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-[76px]">
      {/* children = lobby interno (SalaClient) */}
      <div className="mx-auto max-w-6xl px-4 pt-6">{children}</div>

      {/* quando entrar, montamos LiveKit e o vídeo */}
      {inRoom && token && serverUrl ? (
        <LiveKitRoom token={token} serverUrl={serverUrl} connect audio={micOn} video={camOn}>
          <div className="mx-auto max-w-6xl px-4">
            <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-black h-[78vh]">
              <VideoArea pinned={[]} />
            </div>
          </div>
          {panel}
          <Controls />
        </LiveKitRoom>
      ) : null}
    </div>
  );
}
