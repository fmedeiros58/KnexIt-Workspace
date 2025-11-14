"use client";

import { Track } from "livekit-client";
import { useTracks, GridLayout, ParticipantTile } from "@livekit/components-react";

/**
 * Componente simples de vídeo: prioriza telas compartilhadas,
 * depois “pinned”, depois o resto das câmeras.
 */
export default function VideoArea({ pinned }: { pinned: string[] }) {
  const cams = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const screens = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);

  const ordered = [
    ...screens,
    ...cams.filter((t) => pinned.includes(t.participant?.identity ?? "")),
    ...cams.filter((t) => !pinned.includes(t.participant?.identity ?? "")),
  ];

  const hasScreen = screens.length > 0;

  return hasScreen ? (
    <div className="grid gap-2" style={{ gridTemplateRows: "minmax(55vh,1fr) auto" }}>
      <div className="rounded-xl overflow-hidden">
        <GridLayout tracks={[ordered[0]]} style={{ height: "55vh" }}>
          <ParticipantTile />
        </GridLayout>
      </div>
      <div className="rounded-xl overflow-hidden">
        <GridLayout tracks={ordered.slice(1)} style={{ height: "20vh" }}>
          <ParticipantTile />
        </GridLayout>
      </div>
    </div>
  ) : (
    <GridLayout tracks={ordered} style={{ height: "100%" }}>
      <ParticipantTile />
    </GridLayout>
  );
}
