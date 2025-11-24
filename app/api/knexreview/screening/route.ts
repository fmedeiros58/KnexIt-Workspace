import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ScreeningRecord } from "@/lib/knexreview/types";

// TODO: persistir decisões em Supabase; aqui apenas ecoa a entrada.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ScreeningRecord | null;
  if (!body?.recordId || !body.decision) {
    return NextResponse.json({ error: "recordId e decision são obrigatórios" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, record: { ...body, decidedAt: new Date().toISOString() } });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ScreeningRecord | null;
  if (!body?.recordId || !body.decision) {
    return NextResponse.json({ error: "recordId e decision são obrigatórios" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, record: { ...body, decidedAt: new Date().toISOString() } });
}
