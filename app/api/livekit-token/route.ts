// app/api/livekit-token/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { AccessToken, VideoGrant } from "livekit-server-sdk";

export const runtime = "nodejs"; // importante p/ Vercel/Next (não usar Edge)

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const room = url.searchParams.get("room");
  const identity =
    url.searchParams.get("identity") ?? `user-${Math.random().toString(36).slice(2, 8)}`;

  if (!room) {
    return NextResponse.json({ error: "missing room" }, { status: 400 });
  }

  const LIVEKIT_URL = process.env.LIVEKIT_URL!;
  const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
  const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: "LiveKit env vars not set" }, { status: 500 });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: identity,
  });

  at.addGrant(
    new VideoGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // screenShare: true, // (opcional – já é permitido pelo canPublish)
    }),
  );

  const token = await at.toJwt();
  return NextResponse.json({ token, url: LIVEKIT_URL, identity });
}
