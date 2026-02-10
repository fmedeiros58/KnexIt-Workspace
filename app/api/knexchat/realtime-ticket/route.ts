import { NextRequest } from "next/server";
import { getSupabaseAdmin, issueRealtimeTicket, requireKnexchatEntitlement } from "@/app/api/knexchat/_auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;
  const authEmail = entitlement.user?.email ?? "";
  const { ticket, expiresIn } = await issueRealtimeTicket(authEmail);
  return Response.json({ ticket, expiresIn }, { status: 200 });
}
