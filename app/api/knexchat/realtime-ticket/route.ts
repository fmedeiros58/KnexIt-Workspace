import { NextRequest } from "next/server";
import { getSupabaseAdmin, issueRealtimeTicket, resolveAuthEmail } from "@/app/api/knexchat/_auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const authEmail = await resolveAuthEmail(req);
  if (!authEmail) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { ticket, expiresIn } = await issueRealtimeTicket(authEmail);
  return Response.json({ ticket, expiresIn }, { status: 200 });
}
