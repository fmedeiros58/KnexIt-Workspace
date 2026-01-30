import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase service role env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => Boolean(value) && value.includes("@");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || "";

  if (!token) {
    return new Response("Missing token", { status: 401 });
  }

  const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
  const authEmail = data?.user?.email ?? "";
  const email = normalizeEmail(authEmail);

  if (authError || !isValidEmail(email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const send = (event: string, data: unknown) => {
    writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  let channel: ReturnType<typeof supabaseAdmin.channel> | null = null;
  let keepAliveTimer: NodeJS.Timeout | null = null;

  const cleanup = async () => {
    try {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      if (channel) {
        await channel.unsubscribe();
        channel = null;
      }
      await writer.close();
    } catch {
      // ignore
    }
  };

  req.signal.addEventListener("abort", () => {
    void cleanup();
  });

  try {
    const { data: participantRows, error } = await supabaseAdmin
      .from("knexchat_thread_participants")
      .select("thread_id")
      .eq("email", email);

    if (error) throw error;

    const threadIds = Array.from(new Set((participantRows ?? []).map((row) => row.thread_id)));

    channel = supabaseAdmin.channel(`knexchat:${email}:${Date.now()}`);

    threadIds.forEach((threadId) => {
      channel = channel?.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "knexchat_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          send("message", { message: payload.new });
        },
      ) as typeof channel;
    });

    channel?.subscribe();

    send("ready", { threads: threadIds.length });

    keepAliveTimer = setInterval(() => {
      send("ping", { t: Date.now() });
    }, 25000);
  } catch {
    send("error", { message: "Failed to start realtime" });
    void cleanup();
  }

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
