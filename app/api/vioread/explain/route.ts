import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { fragment?: string; context?: string } | null;
  if (!body?.fragment) {
    return NextResponse.json({ error: "fragment obrigatório" }, { status: 400 });
  }
  return NextResponse.json({
    explanation: `[[EXPLICADO]] ${body.fragment.slice(0, 120)}... (mock)`,
  });
}
