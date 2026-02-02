import { NextRequest } from "next/server";
import { consumeRealtimeTicket, getSupabaseAdmin, resolveAuthEmail } from "@/app/api/knexchat/_auth";

export const runtime = "nodejs";

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => Boolean(value) && value.includes("@");

export async function GET(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return new Response("Supabase service role not configured", { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const ticket = searchParams.get("ticket") || "";
  let email = "";

  if (ticket) {
    const ticketEmail = await consumeRealtimeTicket(ticket);
    email = ticketEmail ? normalizeEmail(ticketEmail) : "";
  } else {
    const token = searchParams.get("token") || "";
    if (!token) {
      return new Response("Missing token", { status: 401 });
    }
    const authEmail = await resolveAuthEmail(req, token);
    email = authEmail ? normalizeEmail(authEmail) : "";
  }

  if (!isValidEmail(email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  let isClosed = false;
  const send = (event: string, data: unknown) => {
    if (isClosed) return;
    try {
      void writer
        .write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        .catch(() => {
          isClosed = true;
        });
    } catch {
      isClosed = true;
    }
  };

  let channel: ReturnType<typeof admin.channel> | null = null;
  let keepAliveTimer: NodeJS.Timeout | null = null;

  const cleanup = async () => {
    try {
      isClosed = true;
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
    isClosed = true;
    void cleanup();
  });

  try {
    const { data: participantRows, error } = await admin
      .from("knexchat_thread_participants")
      .select("thread_id")
      .eq("email", email);

    if (error) throw error;

    const threadIds = Array.from(new Set((participantRows ?? []).map((row) => row.thread_id)));

    channel = admin.channel(`knexchat:${email}:${Date.now()}`);

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
