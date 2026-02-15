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
    .from("knexchat_memberships")
    .select("status, knexchat_email, email_normalized, email_verified_at, activated_at, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return Response.json({ message: "Falha ao consultar ativacao." }, { status: 500 });
  }

  const activated = data?.status === "active";

  return Response.json(
    {
      authenticated: true,
      activated,
      membership: data ?? null,
    },
    { status: 200 },
  );
}
