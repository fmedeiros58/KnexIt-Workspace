import { NextRequest } from "next/server";
import { getKnexchatAdmin, requireActivationAuth } from "@/app/api/knexchat/_activation";
import { isEmail, normalizeEmail, verifyOtp } from "@/lib/knexchat/activationOtp";

export const runtime = "nodejs";

const PURPOSE = "knexchat_activation";

export async function POST(req: NextRequest) {
  const auth = await requireActivationAuth(req);
  if (auth.response) return auth.response;

  const admin = getKnexchatAdmin();
  if (!admin) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const otpSalt = process.env.KNEXCHAT_OTP_SALT;
  if (!otpSalt) {
    return Response.json({ message: "Configuracao de OTP incompleta." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email ?? "");
  const code = String(body?.code ?? "").trim();
  const userId = auth.user?.userId ?? "";
  const name = auth.user?.name;

  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isEmail(email)) {
    return Response.json({ message: "E-mail invalido." }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return Response.json({ message: "Codigo invalido." }, { status: 400 });
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

  const { data: token, error } = await admin
    .from("knexchat_verification_tokens")
    .select("id, token_hash, expires_at, attempts, max_attempts, consumed_at")
    .eq("user_id", userId)
    .eq("purpose", PURPOSE)
    .eq("destination_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !token) {
    return Response.json({ message: "Codigo nao encontrado. Solicite um novo." }, { status: 404 });
  }

  if (token.consumed_at) {
    return Response.json({ message: "Codigo ja utilizado. Solicite um novo." }, { status: 400 });
  }

  const now = new Date();
  if (new Date(token.expires_at).getTime() <= now.getTime()) {
    return Response.json({ message: "Codigo expirado. Solicite um novo." }, { status: 400 });
  }

  if (token.attempts >= token.max_attempts) {
    return Response.json({ message: "Limite de tentativas excedido. Solicite um novo codigo." }, { status: 400 });
  }

  const isValid = verifyOtp(code, token.id, otpSalt, token.token_hash);
  if (!isValid) {
    const nextAttempts = token.attempts + 1;
    const updates: { attempts: number; consumed_at?: string | null } = { attempts: nextAttempts };
    if (nextAttempts >= token.max_attempts) {
      updates.consumed_at = now.toISOString();
    }
    await admin.from("knexchat_verification_tokens").update(updates).eq("id", token.id);
    return Response.json({ message: "Codigo incorreto." }, { status: 400 });
  }

  await admin
    .from("knexchat_verification_tokens")
    .update({ consumed_at: now.toISOString() })
    .eq("id", token.id);

  const membershipPayload = {
    user_id: userId,
    status: "active",
    knexchat_email: email,
    email_normalized: email,
    email_verified_at: now.toISOString(),
    activated_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { error: upsertError } = await admin
    .from("knexchat_memberships")
    .upsert(membershipPayload, { onConflict: "user_id" });

  if (upsertError) {
    return Response.json({ message: "Falha ao ativar." }, { status: 500 });
  }

  const { error: directoryError } = await admin
    .from("knexchat_directory")
    .upsert(
      {
        email,
        ...(name ? { name } : {}),
      },
      { onConflict: "email" },
    );

  if (directoryError) {
    return Response.json({ message: "Falha ao atualizar o diretorio." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
