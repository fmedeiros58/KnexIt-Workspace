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

export async function GET(req: NextRequest) {
  const auth = await requireActivationAuth(req);
  if (auth.response) return auth.response;

  const admin = getKnexchatAdmin();
  if (!admin) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const userId = auth.user?.userId ?? "";
  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("value") ?? "";
  const validation = validateNickname(raw);
  if (!validation.ok) {
    return Response.json({ ok: false, error: "invalid_format" }, { status: 200 });
  }

  const normalized = validation.normalized;
  if (isReservedNickname(normalized) || (await isReservedInDb(admin, normalized))) {
    return Response.json({ ok: false, error: "reserved" }, { status: 200 });
  }

  const { data, error } = await admin
    .from("knexchat_profiles")
    .select("user_id")
    .eq("nickname_normalized", normalized)
    .limit(1);

  if (error) {
    return Response.json({ ok: false, error: "lookup_failed" }, { status: 500 });
  }

  const existing = data && data.length ? data[0] : null;
  const available = !existing || existing.user_id === userId;
  return Response.json({ ok: true, available }, { status: 200 });
}
