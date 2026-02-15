import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codeRegex = /^\d{6}$/;

function buildEmailHtml(code: string) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Codigo de acesso KnexChat</h2>
      <p style="margin: 0 0 16px;">Use este codigo para ativar seu Knex ID:</p>
      <div style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #0f172a; color: #ffffff; font-size: 24px; letter-spacing: 6px; font-weight: 700;">
        ${code}
      </div>
      <p style="margin: 16px 0 0;">Se voce nao solicitou este codigo, ignore este e-mail.</p>
    </div>
  `;
}

function buildEmailText(code: string) {
  return [
    "Codigo de acesso KnexChat",
    "",
    "Use este codigo para ativar seu Knex ID:",
    code,
    "",
    "Se voce nao solicitou este codigo, ignore este e-mail.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    if (!apiKey) {
      return NextResponse.json({ message: "RESEND_API_KEY nao configurada." }, { status: 500 });
    }

    if (!from) {
      return NextResponse.json({ message: "RESEND_FROM nao configurado." }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.code ?? "").trim();

    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "E-mail invalido." }, { status: 400 });
    }

    if (!codeRegex.test(code)) {
      return NextResponse.json({ message: "Codigo invalido." }, { status: 400 });
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: "Seu codigo KnexChat",
      html: buildEmailHtml(code),
      text: buildEmailText(code),
    });

    if (error) {
      return NextResponse.json({ message: error.message ?? "Erro ao enviar e-mail." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("KNEXCHAT_OTP_ERROR", err);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
