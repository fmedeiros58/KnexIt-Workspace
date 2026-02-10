import { NextRequest } from "next/server";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";
import { getResendClient } from "@/lib/resend";

export const runtime = "nodejs";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_LIMIT = 3;

const getClientIp = (req: NextRequest) => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "";
  }
  return req.headers.get("x-real-ip") || "";
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  const requestedType = String(body?.type ?? "magiclink").trim();
  const password = String(body?.password ?? "").trim();
  const otpType = requestedType === "signup" ? "signup" : requestedType === "recovery" ? "recovery" : "magiclink";

  if (!emailRegex.test(email)) {
    return Response.json({ message: "E-mail inválido." }, { status: 400 });
  }

  let admin;
  try {
    admin = identitySupabaseAdmin();
  } catch (err) {
    return Response.json({ message: "Identity service role not configured." }, { status: 500 });
  }
  const since = new Date(Date.now() - REQUEST_WINDOW_MS).toISOString();
  const ip = getClientIp(req);

  const { count: emailCount, error: emailCountError } = await admin
    .from("auth_email_otps")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("kind", "request")
    .gte("created_at", since);

  if (emailCountError) {
    return Response.json(
      {
        message:
          process.env.NODE_ENV === "development"
            ? emailCountError.message
            : "Falha ao validar limite.",
      },
      { status: 500 },
    );
  }

  if ((emailCount ?? 0) >= REQUEST_LIMIT) {
    return Response.json({ message: "Limite de envios atingido. Tente novamente em alguns minutos." }, { status: 429 });
  }

  if (ip) {
    const { count: ipCount, error: ipCountError } = await admin
      .from("auth_email_otps")
      .select("id", { count: "exact", head: true })
      .eq("request_ip", ip)
      .eq("kind", "request")
      .gte("created_at", since);
    if (ipCountError) {
      return Response.json(
        {
          message:
            process.env.NODE_ENV === "development"
              ? ipCountError.message
              : "Falha ao validar limite.",
        },
        { status: 500 },
      );
    }
    if ((ipCount ?? 0) >= REQUEST_LIMIT) {
      return Response.json({ message: "Limite de envios atingido. Tente novamente em alguns minutos." }, { status: 429 });
    }
  }

  const insertResult = await admin.from("auth_email_otps").insert({
    email,
    kind: "request",
    request_ip: ip || null,
  });

  if (insertResult.error) {
    return Response.json(
      {
        message:
          process.env.NODE_ENV === "development"
            ? insertResult.error.message
            : "Falha ao registrar solicitação.",
      },
      { status: 500 },
    );
  }

  if (otpType === "signup" && !password) {
    return Response.json({ message: "Senha obrigatória para criar conta." }, { status: 400 });
  }

  let generateLinkParams;
  if (otpType === "signup") {
    if (!password) {
      return Response.json({ message: "Senha obrigatória para criar conta." }, { status: 400 });
    }
    generateLinkParams = {
      type: "signup" as const,
      email,
      password,
      options: name ? { data: { name } } : undefined,
    };
  } else if (otpType === "recovery") {
    generateLinkParams = {
      type: "recovery" as const,
      email,
    };
  } else {
    generateLinkParams = {
      type: "magiclink" as const,
      email,
      options: name ? { data: { name } } : undefined,
    };
  }

  const { data, error } = await admin.auth.admin.generateLink(generateLinkParams);

  if (error || !data?.properties?.email_otp) {
    return Response.json({ message: error?.message ?? "Falha ao gerar código." }, { status: 400 });
  }

  const resend = getResendClient();
  const resendFrom = process.env.RESEND_FROM?.trim();
  if (!resend || !resendFrom) {
    return Response.json({ message: "Serviço de e-mail não configurado." }, { status: 500 });
  }

  const code = data.properties.email_otp;
  const subject = "Seu código de acesso Knexspace One";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Seu código de acesso</h2>
      <p style="margin: 0 0 16px;">Use o código abaixo para confirmar seu acesso:</p>
      <p style="margin: 0 0 24px; font-size: 28px; letter-spacing: 6px;"><strong>${code}</strong></p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Este código expira em alguns minutos.</p>
    </div>
  `;
  const text = `Seu código de acesso: ${code}\n\nEste código expira em alguns minutos.`;

  const { error: sendError } = await resend.emails.send({
    from: resendFrom,
    to: [email],
    subject,
    html,
    text,
  });

  if (sendError) {
    return Response.json({ message: sendError.message ?? "Erro ao enviar e-mail." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
