import { NextRequest } from "next/server";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";
import { getResendClient } from "@/lib/resend";
import { mapFlowToOtpKind, mapFlowToSupabaseOtpType, resolveOtpFlow } from "@/lib/otpKinds";
import { findUserByEmail } from "@/lib/identityUserLookup";
import crypto from "crypto";

export const runtime = "nodejs";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_LIMIT = 5;
const HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY?.trim();

type CaptchaResult = { ok: true } | { ok: false; message: string };

const verifyHcaptcha = async (token: string, ip: string): Promise<CaptchaResult> => {
  if (!HCAPTCHA_SECRET_KEY) return { ok: true };
  if (!token) {
    return { ok: false, message: "Confirme o captcha." };
  }
  const params = new URLSearchParams();
  params.set("secret", HCAPTCHA_SECRET_KEY);
  params.set("response", token);
  if (ip) params.set("remoteip", ip);
  const response = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const payload = (await response.json().catch(() => null)) as { success?: boolean };
  if (!payload?.success) {
    return { ok: false, message: "Falha ao validar captcha." };
  }
  return { ok: true };
};

const generateOtpCode = () => {
  const value = crypto.randomInt(0, 1000000);
  return value.toString().padStart(6, "0");
};

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

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
  const requestedType = String(body?.purpose ?? body?.type ?? "").trim();
  const mode = String(body?.mode ?? "").trim();
  const password = String(body?.password ?? "").trim();
  const captchaToken = String(body?.captchaToken ?? "").trim();
  const flow = resolveOtpFlow({ mode, type: requestedType });

  if (!flow) {
    return Response.json(
      { message: "Tipo de OTP inválido para este fluxo.", code: "OTP_KIND_INVALID" },
      { status: 400 },
    );
  }
  const requestKind = mapFlowToOtpKind(flow, "request");

  if (!emailRegex.test(email)) {
    return Response.json({ message: "E-mail inválido." }, { status: 400 });
  }

  const domain = email.split("@")[1] ?? "";
  console.info("[auth] otp_request", { flow, mode, domain });

  const ip = getClientIp(req);
  if (flow === "signup" && HCAPTCHA_SECRET_KEY) {
    const captchaResult = await verifyHcaptcha(captchaToken, ip);
    if (!captchaResult.ok) {
      return Response.json({ message: captchaResult.message }, { status: 400 });
    }
  }

  let admin;
  try {
    admin = identitySupabaseAdmin();
  } catch (err) {
    return Response.json({ message: "Identity service role not configured." }, { status: 500 });
  }
  const needsExistingUser = flow === "login" || flow === "recovery" || flow === "oauth_verify";
  if (needsExistingUser || flow === "signup") {
    const { user: existingUser, error: userError } = await findUserByEmail(admin, email);
    if (userError) {
      return Response.json(
        {
          message:
            process.env.NODE_ENV === "development"
              ? userError.message
              : "Falha ao validar o e-mail.",
        },
        { status: 500 },
      );
    }
    if (needsExistingUser && !existingUser) {
      return Response.json(
        { message: "E-mail não encontrado. Crie sua conta.", code: "USER_NOT_FOUND" },
        { status: 404 },
      );
    }
    if (flow === "signup" && existingUser) {
      return Response.json(
        { message: "E-mail já cadastrado. Faça login.", code: "EMAIL_EXISTS" },
        { status: 409 },
      );
    }
  }
  const since = new Date(Date.now() - REQUEST_WINDOW_MS).toISOString();
  const { count: emailCount, error: emailCountError } = await admin
    .from("auth_email_otps")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("kind", requestKind)
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

  const nextAttempt = (emailCount ?? 0) + 1;
  if (nextAttempt > REQUEST_LIMIT) {
    return Response.json({ message: "Limite de envios atingido. Tente novamente em alguns minutos." }, { status: 429 });
  }

  // limite apenas por e-mail (não usar IP/IMEI)

  if (flow === "signup" && !password) {
    return Response.json({ message: "Senha obrigatória para criar conta." }, { status: 400 });
  }

  const resend = getResendClient();
  const resendFrom = process.env.RESEND_FROM?.trim();
  if (!resend || !resendFrom) {
    return Response.json({ message: "Serviço de e-mail não configurado." }, { status: 500 });
  }

  if (flow === "signup" || flow === "oauth_verify") {
    const code = generateOtpCode();
    const tokenHash = hashToken(code);
    const { error: signupInsertError } = await admin.from("auth_email_otps").insert({
      email,
      kind: requestKind,
      token_hash: tokenHash,
      request_ip: ip || null,
    });

    if (signupInsertError) {
      if (signupInsertError.message?.includes("auth_email_otps_kind_check")) {
        return Response.json(
          { message: "Não foi possível enviar o código. Tente novamente.", code: "OTP_KIND_INVALID" },
          { status: 400 },
        );
      }
      return Response.json(
        {
          message:
            process.env.NODE_ENV === "development"
              ? signupInsertError.message
              : "Falha ao registrar solicitação.",
        },
        { status: 500 },
      );
    }

    const subject =
      flow === "oauth_verify"
        ? "Confirme seu acesso Knexspace One"
        : "Seu código de acesso Knexspace One";
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

  const otpType = mapFlowToSupabaseOtpType(flow);
  const insertResult = await admin.from("auth_email_otps").insert({
    email,
    kind: requestKind,
    request_ip: ip || null,
  });

  if (insertResult.error) {
    if (insertResult.error.message?.includes("auth_email_otps_kind_check")) {
      return Response.json(
        { message: "Não foi possível enviar o código. Tente novamente.", code: "OTP_KIND_INVALID" },
        { status: 400 },
      );
    }
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

  let generateLinkParams;
  if (otpType === "recovery") {
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
