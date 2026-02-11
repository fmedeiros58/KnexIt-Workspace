import { NextRequest } from "next/server";
import { getKnexchatAdmin, requireActivationAuth } from "@/app/api/knexchat/_activation";

export const runtime = "nodejs";

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

  const { data, error } = await admin
    .from("knexchat_profiles")
    .select("nickname, display_name, terms_accepted_at, activated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return Response.json({ message: "Falha ao consultar perfil." }, { status: 500 });
  }

  const hasProfile = Boolean(data);
  const hasNickname = Boolean(data?.nickname);
  const activated = Boolean(data?.activated_at);

  return Response.json(
    {
      authenticated: true,
      has_profile: hasProfile,
      has_nickname: hasNickname,
      activated,
      profile: data ?? null,
    },
    { status: 200 },
  );
}
