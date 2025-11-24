import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ExtractionRecord } from "@/lib/knexreview/types";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ExtractionRecord | null;
  if (!body?.recordId || !Array.isArray(body.fields)) {
    return NextResponse.json({ error: "recordId e fields são obrigatórios" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, record: { ...body, updatedAt: new Date().toISOString() } });
}
