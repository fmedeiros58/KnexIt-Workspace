// @ts-nocheck
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function buildToken(room: string, identity: string) {
  const LIVEKIT_URL = process.env.LIVEKIT_URL;
  const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
  const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json(
      {
        error: 'LiveKit env vars not set',
        details: {
          LIVEKIT_URL: !!LIVEKIT_URL,
          LIVEKIT_API_KEY: !!LIVEKIT_API_KEY,
          LIVEKIT_API_SECRET: !!LIVEKIT_API_SECRET,
        },
      },
      { status: 500 },
    );
  }

  // dynamically import AccessToken to avoid type-only import issues
  const { AccessToken } = await import('livekit-server-sdk');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const at = new (AccessToken as any)(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: identity,
  });

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url: LIVEKIT_URL, identity });
}

// GET ?room=&identity=
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const room = url.searchParams.get('room');

  // trata identity vazio
  const raw = url.searchParams.get('identity')?.trim();
  const identity = raw && raw.length > 0
    ? raw
    : `user-${Math.random().toString(36).slice(2, 8)}`;

  if (!room) {
    return NextResponse.json({ error: 'missing room' }, { status: 400 });
  }

  return buildToken(room, identity);
}

// POST { roomName?|room?, identity? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const room = body.roomName || body.room;

  // trata identity vazio
  const raw: string | undefined = typeof body.identity === 'string' ? body.identity.trim() : undefined;
  const identity = raw && raw.length > 0
    ? raw
    : `user-${Math.random().toString(36).slice(2, 8)}`;

  if (!room) {
    return NextResponse.json({ error: 'missing room' }, { status: 400 });
  }

  return buildToken(room, identity);
}
