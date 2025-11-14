import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasUrl: !!process.env.LIVEKIT_URL,
    hasKey: !!process.env.LIVEKIT_API_KEY,
    hasSecret: !!process.env.LIVEKIT_API_SECRET,
    url: process.env.LIVEKIT_URL || null, // não mostra segredos
  });
}
