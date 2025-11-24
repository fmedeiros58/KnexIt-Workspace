import { NextRequest, NextResponse } from "next/server";
import { listTemplates, saveTemplate } from "@/lib/knexmail/store";
import type { MailTemplate } from "@/lib/knexmail/types";

export async function GET() {
  return NextResponse.json({ templates: listTemplates() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as MailTemplate | null;
  if (!body?.id || !body.name || !body.subject) {
    return NextResponse.json({ error: "id, name e subject são obrigatórios" }, { status: 400 });
  }
  const saved = saveTemplate({ ...body, updatedAt: new Date().toISOString() });
  return NextResponse.json({ template: saved });
}

