import { NextRequest } from "next/server";
import { Resend } from "resend";
import crypto from "crypto";
import { getKnexchatAdmin, requireActivationAuth } from "@/app/api/knexchat/_activation";
import { generateOtpCode, hashOtp, isEmail, normalizeEmail } from "@/lib/knexchat/activationOtp";

export const runtime = "nodejs";

const PURPOSE = "knexchat_activation";
const COOLDOWN_SECONDS = 60;
const EXPIRY_MINUTES = 10;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_LIMIT = 100;

const buildEmailHtml = (code: string) => `
  <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a;">
    <h2 style="margin: 0 0 12px;">Codigo de ativacao do KnexChat</h2>
    <p style="margin: 0 0 16px;">Use o codigo abaixo para ativar o KnexChat.</p>
    <div style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #0f172a; color: #ffffff; font-size: 24px; letter-spacing: 6px; font-weight: 700;">
      ${code}
    </div>
    <p style="margin: 16px 0 0;">Este codigo expira em ${EXPIRY_MINUTES} minutos. Se nao foi voce, ignore este e-mail.</p>
  </div>
`;

const buildEmailText = (code: string) =>
  [
    "Codigo de ativacao do KnexChat",
    "",
    "Use o codigo abaixo para ativar o KnexChat:",
    code,
    "",
    `Este codigo expira em ${EXPIRY_MINUTES} minutos.`,
    "Se nao foi voce, ignore este e-mail.",
  ].join("\n");

export async function POST(req: NextRequest) {
  const auth = await requireActivationAuth(req);
  if (auth.response) return auth.response;

  const admin = getKnexchatAdmin();
  if (!admin) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const otpSalt = process.env.KNEXCHAT_OTP_SALT;

  if (!apiKey || !from || !otpSalt) {
    return Response.json({ message: "Configuracao de e-mail incompleta." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === "custom" ? "custom" : "ecosystem";
  const rawEmail = normalizeEmail(body?.email ?? "");
  const userId = auth.user?.userId ?? "";
  const ecosystemEmail = normalizeEmail(auth.user?.email ?? "");

  if (!userId || !ecosystemEmail) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isEmail(rawEmail)) {
    return Response.json({ message: "E-mail invalido." }, { status: 400 });
  }

  if (mode === "ecosystem" && rawEmail !== ecosystemEmail) {
    return Response.json({ message: "Use o e-mail do ecossistema para este modo." }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await admin
    .from("knexchat_memberships")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    return Response.json({ message: "Falha ao validar ativacao." }, { status: 500 });
  }

  if (membership?.status === "locked") {
    return Response.json({ message: "Ativacao bloqueada. Fale com o suporte." }, { status: 423 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - REQUEST_WINDOW_MS).toISOString();

  const { count } = await admin
    .from("knexchat_verification_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("purpose", PURPOSE)
    .gte("created_at", since);

  if ((count ?? 0) >= REQUEST_LIMIT) {
    return Response.json(
      { message: "Limite de envios atingido nesta etapa. Aguarde 15 minutos para tentar novamente." },
      { status: 429 },
    );
  }

  const { data: lastToken } = await admin
    .from("knexchat_verification_tokens")
    .select("last_sent_at, created_at")
    .eq("user_id", userId)
    .eq("purpose", PURPOSE)
    .eq("destination_email", rawEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSent = lastToken?.last_sent_at || lastToken?.created_at;
  if (lastSent) {
    const lastSentMs = new Date(lastSent).getTime();
    if (Number.isFinite(lastSentMs) && now.getTime() - lastSentMs < COOLDOWN_SECONDS * 1000) {
      const wait = Math.max(1, Math.ceil((COOLDOWN_SECONDS * 1000 - (now.getTime() - lastSentMs)) / 1000));
      return Response.json({ message: `Aguarde ${wait}s para reenviar.` }, { status: 429 });
    }
  }

  const code = generateOtpCode();
  const tokenId = crypto.randomUUID();
  const tokenHash = hashOtp(code, tokenId, otpSalt);
  const expiresAt = new Date(now.getTime() + EXPIRY_MINUTES * 60 * 1000).toISOString();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const { error: insertError } = await admin.from("knexchat_verification_tokens").insert({
    id: tokenId,
    user_id: userId,
    purpose: PURPOSE,
    destination_email: rawEmail,
    token_hash: tokenHash,
    expires_at: expiresAt,
    attempts: 0,
    max_attempts: 5,
    sent_count: 1,
    last_sent_at: now.toISOString(),
    created_at: now.toISOString(),
    ip_address: ip,
    user_agent: userAgent,
  });

  if (insertError) {
    return Response.json({ message: "Falha ao registrar o codigo." }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from,
    to: [rawEmail],
    subject: "Codigo de ativacao do KnexChat",
    html: buildEmailHtml(code),
    text: buildEmailText(code),
  });

  if (sendError) {
    return Response.json({ message: sendError.message ?? "Erro ao enviar e-mail." }, { status: 500 });
  }

  return Response.json(
    { ok: true, cooldown: COOLDOWN_SECONDS, expires_in: EXPIRY_MINUTES * 60 },
    { status: 200 },
  );
}
