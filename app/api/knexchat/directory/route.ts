import { NextRequest } from "next/server";
import { getSupabaseAdmin, requireKnexchatEntitlement } from "@/app/api/knexchat/_auth";

export const runtime = "nodejs";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export async function GET(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;
  const authEmail = entitlement.user?.email ?? "";
  const { searchParams } = new URL(req.url);
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }
    const emailParam = searchParams.get("email");
    if (emailParam) {
      const email = normalizeEmail(emailParam);
      if (!email || !email.includes("@")) {
        return Response.json({ message: "Invalid email" }, { status: 400 });
      }
      const { data, error } = await admin
        .from("knexchat_directory")
        .select("email")
        .eq("email", email)
        .limit(1);
      if (error) throw error;
      return Response.json({ exists: Boolean(data && data.length) }, { status: 200 });
    }

    const rawLimit = searchParams.get("limit");
    const rawOffset = searchParams.get("offset");
    const rawQuery = searchParams.get("q")?.trim() ?? "";
    const limitParsed = rawLimit ? Number.parseInt(rawLimit, 10) : 100;
    const offsetParsed = rawOffset ? Number.parseInt(rawOffset, 10) : 0;
    const limit = Number.isFinite(limitParsed) ? Math.min(Math.max(limitParsed, 1), 200) : 100;
    const offset = Number.isFinite(offsetParsed) ? Math.max(offsetParsed, 0) : 0;

    let query = admin
      .from("knexchat_directory")
      .select("email, name, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (rawQuery) {
      const safeQuery = rawQuery.replace(/[%_]/g, "\\$&");
      query = query.or(`email.ilike.%${safeQuery}%,name.ilike.%${safeQuery}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const entries = (data ?? []) as { email: string; name?: string | null; created_at: string }[];
    if (!entries.length) {
      return Response.json({ entries: [], offset, limit }, { status: 200 });
    }
    const avatarByEmail = new Map<string, string | null>();
    try {
      const { data: profileRows, error: profileError } = await admin
        .from("profiles")
        .select("email, avatar_url")
        .in(
          "email",
          entries.map((entry) => entry.email),
        );
      if (!profileError) {
        (profileRows ?? []).forEach((row) => {
          avatarByEmail.set(row.email, row.avatar_url ?? null);
        });
      }
    } catch {
      // Avatar enrichment is best-effort for directory listing.
    }
    const enriched = entries.map((entry) => ({
      ...entry,
      avatar_url: avatarByEmail.get(entry.email) ?? null,
    }));
    return Response.json({ entries: enriched, offset, limit }, { status: 200 });
  } catch (err) {
    return Response.json({ message: "Lookup failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;
  const authEmail = entitlement.user?.email ?? "";
  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const nameRaw = typeof body?.name === "string" ? body.name : null;
    const email = normalizeEmail(emailRaw);
    if (!email || !email.includes("@")) {
      return Response.json({ message: "Invalid email" }, { status: 400 });
    }
    if (email !== authEmail) {
      return Response.json({ message: "Forbidden" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }
    const normalizedName = nameRaw && nameRaw.trim() ? nameRaw.trim() : undefined;
    const { error } = await admin
      .from("knexchat_directory")
      .upsert(
        {
          email,
          ...(normalizedName ? { name: normalizedName } : {}),
        },
        { onConflict: "email" },
      );

    if (error) throw error;

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return Response.json({ message: "Insert failed" }, { status: 500 });
  }
}
