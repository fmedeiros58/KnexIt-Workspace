import { NextRequest, NextResponse } from "next/server";
import { listCampaigns, saveCampaign } from "@/lib/knexmail/store";
import type { MailCampaign } from "@/lib/knexmail/types";

export async function GET() {
  return NextResponse.json({ campaigns: listCampaigns() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as MailCampaign | null;
  if (!body?.id || !body.name || !body.templateId) {
    return NextResponse.json({ error: "id, name e templateId são obrigatórios" }, { status: 400 });
  }
  const saved = saveCampaign(body);
  return NextResponse.json({ campaign: saved });
}
