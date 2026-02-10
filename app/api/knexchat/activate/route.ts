import { NextRequest } from "next/server";
import { getKnexchatAdmin, requireActivationAuth } from "@/app/api/knexchat/_activation";
import { isReservedNickname, validateNickname } from "@/lib/knexchat/nickname";

export const runtime = "nodejs";

const isReservedInDb = async (
  admin: ReturnType<typeof getKnexchatAdmin>,
  value: string,
) => {
  if (!admin) return false;
  const { data, error } = await admin
    .from("knexchat_reserved_nicknames")
    .select("nickname_normalized")
    .eq("nickname_normalized", value)
    .limit(1);
  if (error) return false;
  return Boolean(data && data.length);
};

export async function POST(req: NextRequest) {
  const auth = await requireActivationAuth(req);
  if (auth.response) return auth.response;
  const admin = getKnexchatAdmin();
  if (!admin) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = auth.user?.userId ?? "";
  const userEmail = auth.user?.email ?? "";
  if (!userId || !userEmail) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const nicknameRaw = typeof body?.nickname === "string" ? body.nickname : "";
  const displayNameRaw = typeof body?.display_name === "string" ? body.display_name : "";
  const acceptTerms = Boolean(body?.accept_terms);

  const validation = validateNickname(nicknameRaw);
  if (!validation.ok) {
    return Response.json({ message: "Nickname invalido.", code: "invalid_format", error: validation.error }, { status: 400 });
  }

  const normalized = validation.normalized;
  if (isReservedNickname(normalized) || (await isReservedInDb(admin, normalized))) {
    return Response.json({ message: "Nickname reservado.", code: "reserved" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await admin
    .from("knexchat_profiles")
    .select("nickname_normalized, terms_accepted_at, activated_at, nickname_updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    return Response.json({ message: "Falha ao consultar perfil." }, { status: 500 });
  }

  if (!acceptTerms && !existing?.terms_accepted_at) {
    return Response.json({ message: "Aceite os termos para continuar.", code: "terms_required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const nicknameChanged = !existing || existing.nickname_normalized !== normalized;
  const displayName = displayNameRaw && displayNameRaw.trim() ? displayNameRaw.trim() : null;

  const payload = {
    user_id: userId,
    nickname: normalized,
    nickname_normalized: normalized,
    display_name: displayName,
    terms_accepted_at: existing?.terms_accepted_at ?? (acceptTerms ? now : null),
    activated_at: existing?.activated_at ?? now,
    nickname_updated_at: nicknameChanged ? now : existing?.nickname_updated_at ?? now,
    updated_at: now,
  };

  const { error: upsertError } = await admin.from("knexchat_profiles").upsert(payload, { onConflict: "user_id" });

  if (upsertError) {
    if (upsertError.code === "23505" || /duplicate key/i.test(upsertError.message)) {
      return Response.json({ message: "Nickname indisponivel.", code: "nickname_taken" }, { status: 409 });
    }
    return Response.json({ message: "Falha ao ativar.", code: "activate_failed" }, { status: 500 });
  }

  const directoryName = displayName || auth.user?.name || undefined;
  const { error: directoryError } = await admin
    .from("knexchat_directory")
    .upsert(
      {
        email: userEmail,
        ...(directoryName ? { name: directoryName } : {}),
      },
      { onConflict: "email" },
    );

  if (directoryError) {
    return Response.json({ message: "Falha ao atualizar o diretorio." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
