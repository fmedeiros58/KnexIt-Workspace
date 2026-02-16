import { NextRequest } from "next/server";
import { getKnexchatAdmin, requireActivationAuth } from "@/app/api/knexchat/_activation";
import { ensureUserEntitlementActive } from "@/lib/entitlement";

export const runtime = "nodejs";
const APP_KEY = "knexchat";

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
  const { data: profile, error: profileError } = await admin
    .from("knexchat_profiles")
    .select("nickname, nickname_normalized, display_name, terms_accepted_at, activated_at, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return Response.json({ message: "Falha ao consultar perfil de ativacao." }, { status: 500 });
  }

  const profileCompleted = Boolean(
    activated &&
      profile?.nickname_normalized &&
      profile?.terms_accepted_at,
  );

  if (activated) {
    const entitlementResult = await ensureUserEntitlementActive({
      userId,
      appKey: APP_KEY,
      startsAt: data?.activated_at ?? null,
    });
    if (!entitlementResult.ok) {
      console.error("[knexchat] failed to provision entitlement on status", entitlementResult.error);
    }
  }

  return Response.json(
    {
      authenticated: true,
      activated,
      profile_completed: profileCompleted,
      membership: data ?? null,
      profile: profile ?? null,
    },
    { status: 200 },
  );
}
