import { NextRequest } from "next/server";
import crypto from "crypto";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";
import { getResendClient } from "@/lib/resend";
import { mapFlowToOtpKind, mapFlowToSupabaseOtpType, resolveOtpFlow } from "@/lib/otpKinds";
import { findUserByEmail } from "@/lib/identityUserLookup";

export const runtime = "nodejs";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenRegex = /^\d{6}$/;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_LIMIT = 100;
const WARNING_THRESHOLD = 2;

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const token = String(body?.code ?? body?.token ?? "").trim();
  const password = String(body?.password ?? "").trim();
  const rawType = String(body?.purpose ?? body?.type ?? "").trim();
  const mode = String(body?.mode ?? "").trim();
  const flow = resolveOtpFlow({ mode, type: rawType });

  if (!flow) {
    return Response.json(
      { message: "Tipo de OTP inválido para este fluxo.", code: "OTP_KIND_INVALID" },
      { status: 400 },
    );
  }
  if (!emailRegex.test(email)) {
    return Response.json({ message: "E-mail inválido." }, { status: 400 });
  }
  if (!tokenRegex.test(token)) {
    return Response.json({ message: "Código inválido." }, { status: 400 });
  }

  const domain = email.split("@")[1] ?? "";
  console.info("[auth] otp_verify", { flow, mode, domain });

  let admin;
  try {
    admin = identitySupabaseAdmin();
  } catch (err) {
    return Response.json({ message: "Identity service role not configured." }, { status: 500 });
  }
  const since = new Date(Date.now() - VERIFY_WINDOW_MS).toISOString();
  const tokenHash = hashToken(token);

  const verifyKind = mapFlowToOtpKind(flow, "verify");
  const requestKind = mapFlowToOtpKind(flow, "request");
  const { count: failCount, error: failCountError } = await admin
    .from("auth_email_otps")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("kind", verifyKind)
    .gte("created_at", since);

  if (failCountError) {
    return Response.json(
      {
        message:
          process.env.NODE_ENV === "development" ? failCountError.message : "Falha ao validar limite.",
      },
      { status: 500 },
    );
  }

  if ((failCount ?? 0) >= VERIFY_LIMIT) {
    return Response.json(
      { message: "Limite de tentativas atingido nesta etapa. Aguarde 15 minutos para tentar novamente." },
      { status: 429 },
    );
  }

  const sendWarningIfNeeded = async (nextFailCount: number) => {
    if (nextFailCount <= WARNING_THRESHOLD) return;
    if (nextFailCount !== WARNING_THRESHOLD + 1) return;

    const resend = getResendClient();
    const resendFrom = process.env.RESEND_FROM?.trim();
    if (!resend || !resendFrom) return;

    const subject = "Alerta de segurança da sua conta Knexspace";
    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Tentativas de acesso detectadas</h2>
        <p style="margin: 0 0 12px;">
          Identificamos várias tentativas com código inválido para acessar sua conta Knexspace.
        </p>
        <p style="margin: 0 0 16px;">
          Se não foi você, recomendamos alterar sua senha e revisar os acessos.
        </p>
        <p style="margin: 0; color: #64748b; font-size: 14px;">Este é um aviso automático de segurança.</p>
      </div>
    `;
    const text =
      "Identificamos várias tentativas com código inválido para acessar sua conta Knexspace. Se não foi você, recomendamos alterar sua senha e revisar os acessos.";

    const { error: sendError } = await resend.emails.send({
      from: resendFrom,
      to: [email],
      subject,
      html,
      text,
    });

    if (sendError) return;
  };

  if (flow === "signup" || flow === "oauth_verify") {
    if (!password) {
      if (flow === "signup") {
        return Response.json({ message: "Senha obrigatória para criar conta." }, { status: 400 });
      }
    }

    const { data: signupTokens, error: signupError } = await admin
      .from("auth_email_otps")
      .select("id")
      .eq("email", email)
      .eq("kind", requestKind)
      .eq("token_hash", tokenHash)
      .gte("created_at", since)
      .limit(1);

    if (signupError) {
      return Response.json(
        {
          message:
            process.env.NODE_ENV === "development" ? signupError.message : "Falha ao validar código.",
        },
        { status: 500 },
      );
    }

    if (!signupTokens || signupTokens.length === 0) {
      const { error: failInsertError } = await admin.from("auth_email_otps").insert({
        email,
        kind: verifyKind,
        token_hash: tokenHash,
      });
      if (failInsertError?.message?.includes("auth_email_otps_kind_check")) {
        return Response.json(
          { message: "Não foi possível validar o código. Tente novamente.", code: "OTP_KIND_INVALID" },
          { status: 400 },
        );
      }
      await sendWarningIfNeeded((failCount ?? 0) + 1);
      return Response.json({ message: "Código inválido." }, { status: 401 });
    }

    await admin
      .from("auth_email_otps")
      .delete()
      .eq("email", email)
      .eq("kind", requestKind)
      .eq("token_hash", tokenHash);

    if (flow === "oauth_verify") {
      const { user: oauthUser } = await findUserByEmail(admin, email);
      if (!oauthUser?.id) {
        return Response.json({ message: "Usuário não encontrado." }, { status: 404 });
      }
      await admin.auth.admin.updateUserById(oauthUser.id, {
        user_metadata: { email_verified_by_code_at: new Date().toISOString() },
      });
      return Response.json({ ok: true, sessionCreated: false }, { status: 200 });
    }

    const { user: existingUser, error: listError } = await findUserByEmail(admin, email);
    if (listError) {
      return Response.json({ message: listError.message ?? "Falha ao consultar usuário." }, { status: 500 });
    }
    if (!existingUser) {
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError && !/already|registered/i.test(createError.message)) {
        return Response.json({ message: createError.message }, { status: 400 });
      }
    }

    const { data: signInData, error: signInError } = await identitySupabase().auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData?.session) {
      const { error: failInsertError } = await admin.from("auth_email_otps").insert({
        email,
        kind: verifyKind,
        token_hash: tokenHash,
      });
      if (failInsertError?.message?.includes("auth_email_otps_kind_check")) {
        return Response.json(
          { message: "Não foi possível validar o código. Tente novamente.", code: "OTP_KIND_INVALID" },
          { status: 400 },
        );
      }
      await sendWarningIfNeeded((failCount ?? 0) + 1);
      return Response.json({ message: signInError?.message ?? "Falha ao autenticar." }, { status: 401 });
    }

    if (signInData?.session?.user?.id) {
      await admin.auth.admin.updateUserById(signInData.session.user.id, {
        user_metadata: { email_verified_by_code_at: new Date().toISOString() },
      });
    }

    return Response.json({ ok: true, sessionCreated: true, session: signInData.session }, { status: 200 });
  }

  const otpType = mapFlowToSupabaseOtpType(flow);
  const { data, error } = await identitySupabase().auth.verifyOtp({
    email,
    token,
    type: otpType,
  });

  if (error) {
    const { error: failInsertError } = await admin.from("auth_email_otps").insert({
      email,
      kind: verifyKind,
      token_hash: tokenHash,
    });
    if (failInsertError?.message?.includes("auth_email_otps_kind_check")) {
      return Response.json(
        { message: "Não foi possível validar o código. Tente novamente.", code: "OTP_KIND_INVALID" },
        { status: 400 },
      );
    }
    await sendWarningIfNeeded((failCount ?? 0) + 1);
    return Response.json({ message: error.message }, { status: 401 });
  }

  if (data?.user?.id) {
    await admin.auth.admin.updateUserById(data.user.id, {
      user_metadata: { email_verified_by_code_at: new Date().toISOString() },
    });
  }

  return Response.json(
    { ok: true, sessionCreated: Boolean(data?.session), session: data?.session ?? null },
    { status: 200 },
  );
}
