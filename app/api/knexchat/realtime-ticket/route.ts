import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, issueRealtimeTicket, requireKnexchatEntitlement } from "@/app/api/knexchat/_auth";

export const runtime = "nodejs";
const REALTIME_TICKET_COOKIE = "knexchat_rt";

export async function POST(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;
  const authEmail = entitlement.user?.email ?? "";
  const { ticket, expiresIn } = await issueRealtimeTicket(authEmail);

  const useCookieTransport = process.env.NODE_ENV === "production";
  const payload = useCookieTransport
    ? { transport: "cookie" as const, expiresIn }
    : { transport: "query" as const, ticket, expiresIn };

  const response = NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });

  if (useCookieTransport) {
    response.cookies.set({
      name: REALTIME_TICKET_COOKIE,
      value: ticket,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/api/knexchat/realtime",
      maxAge: expiresIn,
    });
  }

  return response;
}
