import { NextRequest } from "next/server";
import { getKnexAiStoreAdmin, normalizeSessionId, normalizeTitle, resolveKnexAiSession } from "@/app/api/knexai/_store";

export const runtime = "nodejs";

const MAX_THREADS = 40;
const MAX_MESSAGES = 2000;

type DbThreadRow = {
  id: string;
  title: string | null;
  updated_at: string;
  last_message_at: string | null;
};

type DbMessageRow = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const admin = getKnexAiStoreAdmin();
  if (!admin) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = normalizeSessionId(searchParams.get("sessionId"));
  const includeMessages = searchParams.get("includeMessages") === "1";
  if (!sessionId) {
    return Response.json({ message: "Invalid sessionId" }, { status: 400 });
  }

  try {
    const session = await resolveKnexAiSession(admin, sessionId, false);
    if (!session) {
      return Response.json({ threads: [] }, { status: 200 });
    }

    const { data: threadsData, error: threadsError } = await admin
      .from("knexai_threads")
      .select("id, title, updated_at, last_message_at")
      .eq("session_id", session.id)
      .order("updated_at", { ascending: false })
      .limit(MAX_THREADS);
    if (threadsError) throw threadsError;

    const threadsRows = (threadsData ?? []) as DbThreadRow[];
    const threadIds = threadsRows.map((thread) => thread.id);

    const messagesByThread = new Map<string, DbMessageRow[]>();
    if (includeMessages && threadIds.length) {
      const { data: messagesData, error: messagesError } = await admin
        .from("knexai_messages")
        .select("id, thread_id, role, content, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: true })
        .limit(MAX_MESSAGES);
      if (messagesError) throw messagesError;

      ((messagesData ?? []) as DbMessageRow[]).forEach((message) => {
        const current = messagesByThread.get(message.thread_id) ?? [];
        current.push(message);
        messagesByThread.set(message.thread_id, current);
      });
    }

    const threads = threadsRows.map((thread) => ({
      id: thread.id,
      title: thread.title || "Novo chat",
      updatedAt: thread.updated_at,
      lastMessageAt: thread.last_message_at,
      messages: (messagesByThread.get(thread.id) ?? []).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
    }));

    return Response.json({ threads }, { status: 200 });
  } catch (error) {
    console.error("KNEXAI_THREADS_GET_ERROR", error);
    return Response.json({ message: "Failed to load threads" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = getKnexAiStoreAdmin();
  if (!admin) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = normalizeSessionId(body?.sessionId);
  const title = normalizeTitle(body?.title);
  if (!sessionId) {
    return Response.json({ message: "Invalid sessionId" }, { status: 400 });
  }

  try {
    const session = await resolveKnexAiSession(admin, sessionId, true);
    if (!session) {
      return Response.json({ message: "Unable to resolve session" }, { status: 500 });
    }

    const { data: threadRow, error: threadError } = await admin
      .from("knexai_threads")
      .insert({
        session_id: session.id,
        title,
        status: "active",
      })
      .select("id, title, updated_at, last_message_at")
      .single();
    if (threadError) throw threadError;

    const thread = threadRow as DbThreadRow;
    return Response.json(
      {
        thread: {
          id: thread.id,
          title: thread.title || "Novo chat",
          updatedAt: thread.updated_at,
          lastMessageAt: thread.last_message_at,
          messages: [],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("KNEXAI_THREADS_POST_ERROR", error);
    return Response.json({ message: "Failed to create thread" }, { status: 500 });
  }
}
