import { NextRequest } from "next/server";
import { getKnexAiStoreAdmin, normalizeSessionId, resolveKnexAiSession } from "@/app/api/knexai/_store";

export const runtime = "nodejs";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MessageRole = "user" | "assistant" | "system";

function normalizeRole(value: unknown): MessageRole | null {
  return value === "user" || value === "assistant" || value === "system" ? value : null;
}

function normalizeContent(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  const admin = getKnexAiStoreAdmin();
  if (!admin) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = normalizeSessionId(body?.sessionId);
  const threadId = typeof body?.threadId === "string" ? body.threadId.trim() : "";
  const role = normalizeRole(body?.role);
  const content = normalizeContent(body?.content);
  const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (!sessionId) return Response.json({ message: "Invalid sessionId" }, { status: 400 });
  if (!uuidRegex.test(threadId)) return Response.json({ message: "Invalid threadId" }, { status: 400 });
  if (!role) return Response.json({ message: "Invalid role" }, { status: 400 });
  if (!content) return Response.json({ message: "Message content required" }, { status: 400 });

  try {
    const session = await resolveKnexAiSession(admin, sessionId, true);
    if (!session) {
      return Response.json({ message: "Unable to resolve session" }, { status: 500 });
    }

    const { data: thread, error: threadError } = await admin
      .from("knexai_threads")
      .select("id")
      .eq("id", threadId)
      .eq("session_id", session.id)
      .maybeSingle();
    if (threadError) throw threadError;
    if (!thread) return Response.json({ message: "Thread not found for session" }, { status: 404 });

    const { data: message, error: insertError } = await admin
      .from("knexai_messages")
      .insert({
        thread_id: threadId,
        role,
        content,
        metadata,
      })
      .select("id, thread_id, role, content, created_at")
      .single();
    if (insertError) throw insertError;

    // Melhor-esforco de trilha de auditoria para memoria operacional.
    if (role === "user") {
      void (async () => {
        try {
          const { error } = await admin.from("knexai_memory_events").insert({
            session_id: session.id,
            thread_id: threadId,
            event: "user_message_received",
            detail: { chars: content.length },
          });
          if (error) console.warn("KNEXAI_MEMORY_EVENT_WRITE_WARN", error.message);
        } catch {
          // melhor-esforco: sem impacto na resposta principal
        }
      })();
    }

    return Response.json(
      {
        message: {
          id: message.id,
          threadId: message.thread_id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("KNEXAI_MESSAGES_POST_ERROR", error);
    return Response.json({ message: "Failed to persist message" }, { status: 500 });
  }
}
