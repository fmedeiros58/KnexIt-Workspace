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

const allowedKinds = new Set(["text", "image", "audio", "file"]);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => Boolean(value) && value.includes("@");
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  const threadId = searchParams.get("threadId") || "";
  const limitRaw = searchParams.get("limit");
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 50;
  const limit = Number.isFinite(limitParsed) ? Math.min(Math.max(limitParsed, 1), 200) : 50;

  if (!uuidRegex.test(threadId)) {
    return Response.json({ message: "Invalid threadId" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }
    const { data: membership, error: membershipError } = await admin
      .from("knexchat_thread_participants")
      .select("email")
      .eq("thread_id", threadId)
      .eq("email", authEmail)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      return Response.json({ message: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin
      .from("knexchat_messages")
      .select("id, thread_id, sender_email, body, kind, media_url, media_name, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return Response.json({ messages: data ?? [] }, { status: 200 });
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
    const threadId = typeof body?.threadId === "string" ? body.threadId : "";
    const senderRaw = typeof body?.senderEmail === "string" ? body.senderEmail : "";
    const senderEmail = normalizeEmail(senderRaw);
    const kindRaw = typeof body?.kind === "string" ? body.kind : "text";
    const messageBody = typeof body?.body === "string" ? body.body.trim() : "";
    const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl.trim() : "";
    const mediaName = typeof body?.mediaName === "string" ? body.mediaName.trim() : "";

    if (!uuidRegex.test(threadId)) {
      return Response.json({ message: "Invalid threadId" }, { status: 400 });
    }

    if (!isValidEmail(senderEmail)) {
      return Response.json({ message: "Invalid senderEmail" }, { status: 400 });
    }
    if (senderEmail !== authEmail) {
      return Response.json({ message: "Forbidden" }, { status: 403 });
    }

    if (!allowedKinds.has(kindRaw)) {
      return Response.json({ message: "Invalid kind" }, { status: 400 });
    }

    if (kindRaw === "text" && !messageBody) {
      return Response.json({ message: "Message body required" }, { status: 400 });
    }

    if (kindRaw !== "text" && !mediaUrl) {
      return Response.json({ message: "Media URL required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }
    const { data: membership, error: membershipError } = await admin
      .from("knexchat_thread_participants")
      .select("email")
      .eq("thread_id", threadId)
      .eq("email", senderEmail)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      return Response.json({ message: "Sender not in thread" }, { status: 403 });
    }

    const { data: message, error: insertError } = await admin
      .from("knexchat_messages")
      .insert({
        thread_id: threadId,
        sender_email: senderEmail,
        body: messageBody || null,
        kind: kindRaw,
        media_url: mediaUrl || null,
        media_name: mediaName || null,
      })
      .select("id, thread_id, sender_email, body, kind, media_url, media_name, created_at")
      .single();

    if (insertError) throw insertError;

    return Response.json({ message }, { status: 201 });
  } catch (err) {
    return Response.json({ message: "Insert failed" }, { status: 500 });
  }
}
