import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: ReturnType<typeof createClient> | null = null;
const getSupabaseAdmin = () => {
  if (!supabaseUrl || !serviceRoleKey) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const extractToken = (req: NextRequest) => {
  const header = req.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
};

async function requireAuthEmail(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const token = extractToken(req);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  const email = data?.user?.email ? normalizeEmail(data.user.email) : "";
  return email || null;
}

export async function GET(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const authEmail = await requireAuthEmail(req);
  if (!authEmail) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const emailParam = searchParams.get("email");
  if (!emailParam) {
    return Response.json({ message: "Missing email" }, { status: 400 });
  }
  const email = normalizeEmail(emailParam);
  if (!email || !email.includes("@")) {
    return Response.json({ message: "Invalid email" }, { status: 400 });
  }
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }
    const { data, error } = await admin
      .from("knexchat_directory")
      .select("email")
      .eq("email", email)
      .limit(1);
    if (error) throw error;
    return Response.json({ exists: Boolean(data && data.length) }, { status: 200 });
  } catch (err) {
    return Response.json({ message: "Lookup failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const authEmail = await requireAuthEmail(req);
  if (!authEmail) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
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
    const { error } = await admin.from("knexchat_directory").insert({
      email,
      name: nameRaw && nameRaw.trim() ? nameRaw.trim() : null,
    });

    if (error) {
      if ("code" in error && error.code === "23505") {
        return Response.json({ message: "Already exists" }, { status: 409 });
      }
      throw error;
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return Response.json({ message: "Insert failed" }, { status: 500 });
  }
}
