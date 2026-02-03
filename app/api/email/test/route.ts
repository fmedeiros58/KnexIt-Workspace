import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";

type EmailTestPayload = {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
};

export async function POST(request: Request) {
  let payload: EmailTestPayload;
  try {
    payload = (await request.json()) as EmailTestPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  if (!to) {
    return NextResponse.json({ ok: false, error: "Missing required field: to." }, { status: 400 });
  }

  const resendFrom = process.env.RESEND_FROM?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey || !resendFrom) {
    return NextResponse.json(
      { ok: false, error: "Missing RESEND_API_KEY or RESEND_FROM in environment." },
      { status: 500 },
    );
  }

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json({ ok: false, error: "Resend client not configured." }, { status: 500 });
  }

  const subject =
    typeof payload.subject === "string" && payload.subject.trim() ? payload.subject.trim() : "Teste Resend";
  const text = typeof payload.text === "string" && payload.text.trim() ? payload.text : "Ola, este e um teste.";
  const html =
    typeof payload.html === "string" && payload.html.trim()
      ? payload.html
      : "<p>Ola, este e um <b>teste</b>.</p>";

  try {
    const { data, error } = await resend.emails.send({
      from: resendFrom,
      to,
      subject,
      text,
      html,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected email send error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
