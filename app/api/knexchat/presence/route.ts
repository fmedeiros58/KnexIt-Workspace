import { NextRequest } from "next/server";
import { getSupabaseAdmin, requireKnexchatEntitlement } from "@/app/api/knexchat/_auth";

export const runtime = "nodejs";

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => Boolean(value) && value.includes("@");

export async function POST(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;

  const authEmail = normalizeEmail(entitlement.user?.email ?? "");
  if (!isValidEmail(authEmail)) {
    return Response.json({ message: "Invalid email" }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }

    const { data: updatedRows, error: updateError } = await admin
      .from("knexchat_directory")
      .update({ updated_at: updatedAt })
      .eq("email", authEmail)
      .select("email")
      .limit(1);

    if (updateError) throw updateError;

    if (!updatedRows?.length) {
      const { error: upsertError } = await admin
        .from("knexchat_directory")
        .upsert(
          {
            email: authEmail,
            updated_at: updatedAt,
          },
          { onConflict: "email" },
        );
      if (upsertError) throw upsertError;
    }

    return Response.json({ ok: true, updated_at: updatedAt }, { status: 200 });
  } catch {
    return Response.json({ message: "Presence update failed" }, { status: 500 });
  }
}
