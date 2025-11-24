import { NextRequest, NextResponse } from "next/server";
import { getTemplateById } from "@/lib/knexmail/store";
import { sendMailRaw, sendMailFromTemplate } from "@/lib/knexmail/mailer";
import type { MailSendRequest } from "@/lib/knexmail/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as
    | (MailSendRequest & { campaignId?: string })
    | { campaignId: string };

  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  if ((body as any).campaignId) {
    // TODO: carregar campanha e enviar para o público definido.
    return NextResponse.json({ ok: true, warning: "Envio de campanha não implementado (mock)" });
  }

  const reqData = body as MailSendRequest;
  if (reqData.templateId) {
    const tmpl = getTemplateById(reqData.templateId);
    if (!tmpl) return NextResponse.json({ error: "Template não encontrado" }, { status: 400 });
    const results = await sendMailFromTemplate({ template: tmpl, to: reqData.to, variables: reqData.variables || {}, origin: reqData.origin });
    return NextResponse.json({ results });
  }

  if (!reqData.subject) return NextResponse.json({ error: "subject obrigatório" }, { status: 400 });
  const result = await sendMailRaw(reqData);
  return NextResponse.json({ results: [result] });
}
