import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { section?: string } | null;
  if (!body?.section) {
    return NextResponse.json({ error: "section obrigatória" }, { status: 400 });
  }
  return NextResponse.json({
    concepts: ["Contexto", "Metodologia", "Resultados", "Aplicações"].map((c) => `${c} (mock)`),
  });
}
