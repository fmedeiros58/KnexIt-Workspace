import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomName = searchParams.get('room') || 'sala-demo';
  const identity = searchParams.get('identity') || 'user-' + Math.random().toString(36).slice(2);

  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, { identity });
  at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });

  const token = await at.toJwt();
  return NextResponse.json({ token, url: process.env.LIVEKIT_URL });
}
