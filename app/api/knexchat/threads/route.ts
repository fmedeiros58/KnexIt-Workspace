import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: SupabaseClient<Database> | null = null;
const getSupabaseAdmin = () => {
  if (!supabaseUrl || !serviceRoleKey) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
};

const allowedKinds = new Set(["direct", "group", "forum"]);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => Boolean(value) && value.includes("@");
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

function uniqueEmails(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeEmail(value);
    if (!isValidEmail(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function getThreadSortTime(thread: {
  last_message_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}) {
  const candidate = thread.last_message_at || thread.updated_at || thread.created_at;
  return candidate ? new Date(candidate).getTime() : 0;
}

async function attachParticipantNames(
  participantsByThread: Record<string, { email: string; role: string }[]>,
  threadIds: string[],
) {
  const allEmails = new Set<string>();
  threadIds.forEach((threadId) => {
    (participantsByThread[threadId] ?? []).forEach((participant) => {
      allEmails.add(participant.email);
    });
  });

  if (!allEmails.size) return participantsByThread;

  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Supabase service role not configured");
  }
  const { data: directoryRows, error } = await admin
    .from("knexchat_directory")
    .select("email, name")
    .in("email", Array.from(allEmails));

  if (error) throw error;

  const nameByEmail = new Map<string, string | null>();
  (directoryRows ?? []).forEach((row) => {
    nameByEmail.set(row.email, row.name ?? null);
  });

  const next: Record<string, { email: string; role: string; name?: string | null }[]> = {};
  threadIds.forEach((threadId) => {
    next[threadId] = (participantsByThread[threadId] ?? []).map((participant) => ({
      ...participant,
      name: nameByEmail.get(participant.email) ?? null,
    }));
  });

  return next;
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
  if (!isValidEmail(email)) {
    return Response.json({ message: "Invalid email" }, { status: 400 });
  }
  if (email !== authEmail) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }
    const { data: participantRows, error: participantsError } = await admin
      .from("knexchat_thread_participants")
      .select("thread_id")
      .eq("email", email);

    if (participantsError) throw participantsError;

    const threadIds = Array.from(new Set((participantRows ?? []).map((row) => row.thread_id)));
    if (!threadIds.length) {
      return Response.json({ threads: [] }, { status: 200 });
    }

    const { data: threads, error: threadsError } = await admin
      .from("knexchat_threads")
      .select("id, kind, title, created_by, created_at, updated_at, last_message_at")
      .in("id", threadIds);

    if (threadsError) throw threadsError;

    const includeParticipants = searchParams.get("includeParticipants") === "1";
    const includeLastMessage = searchParams.get("includeLastMessage") === "1";
    let participantsByThread: Record<string, { email: string; role: string; name?: string | null }[]> = {};
    let lastMessageByThread: Record<string, unknown> = {};

    if (includeParticipants) {
      const { data: participantData, error: participantDataError } = await admin
        .from("knexchat_thread_participants")
        .select("thread_id, email, role")
        .in("thread_id", threadIds);

      if (participantDataError) throw participantDataError;

      participantsByThread = (participantData ?? []).reduce((acc, row) => {
        if (!acc[row.thread_id]) acc[row.thread_id] = [];
        acc[row.thread_id].push({ email: row.email, role: row.role });
        return acc;
      }, {} as Record<string, { email: string; role: string }[]>);

      participantsByThread = await attachParticipantNames(participantsByThread, threadIds);
    }

    if (includeLastMessage) {
      const lastMessagePromises = threadIds.map(async (threadId) => {
        const { data, error } = await admin
          .from("knexchat_messages")
          .select("id, thread_id, sender_email, body, kind, media_url, media_name, created_at")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        return { threadId, message: data?.[0] ?? null };
      });
      const lastMessages = await Promise.all(lastMessagePromises);
      lastMessages.forEach(({ threadId, message }) => {
        lastMessageByThread[threadId] = message;
      });
    }

    const sortedThreads = (threads ?? []).slice().sort((a, b) => getThreadSortTime(b) - getThreadSortTime(a));

    const response = sortedThreads.map((thread) =>
      includeParticipants || includeLastMessage
        ? {
            ...thread,
            ...(includeParticipants ? { participants: participantsByThread[thread.id] ?? [] } : {}),
            ...(includeLastMessage ? { lastMessage: lastMessageByThread[thread.id] ?? null } : {}),
          }
        : thread,
    );

    return Response.json({ threads: response }, { status: 200 });
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
    const createdByRaw = typeof body?.createdBy === "string" ? body.createdBy : "";
    const createdBy = normalizeEmail(createdByRaw);

    if (!isValidEmail(createdBy)) {
      return Response.json({ message: "Invalid createdBy" }, { status: 400 });
    }
    if (createdBy !== authEmail) {
      return Response.json({ message: "Forbidden" }, { status: 403 });
    }

    const kindRaw = typeof body?.kind === "string" ? body.kind : "direct";
    if (!allowedKinds.has(kindRaw)) {
      return Response.json({ message: "Invalid kind" }, { status: 400 });
    }

    const titleRaw = typeof body?.title === "string" ? body.title.trim() : "";
    const title = titleRaw ? titleRaw : null;

    const participantsRaw = Array.isArray(body?.participants) ? body.participants : [];
    const participants = uniqueEmails([...participantsRaw, createdBy]);

    if (participants.length < 1) {
      return Response.json({ message: "Participants required" }, { status: 400 });
    }

    if (kindRaw === "direct" && participants.length < 2) {
      return Response.json({ message: "Direct threads need 2 participants" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }
    const { data: directoryRows, error: directoryError } = await admin
      .from("knexchat_directory")
      .select("email")
      .in("email", participants);

    if (directoryError) throw directoryError;

    const registered = new Set((directoryRows ?? []).map((row) => row.email));
    const missing = participants.filter((email) => !registered.has(email));

    if (missing.length) {
      return Response.json({ message: "Participants not registered", missing }, { status: 422 });
    }

    if (kindRaw === "direct" && participants.length === 2) {
      const [first, second] = participants;
      const { data: firstRows, error: firstError } = await admin
        .from("knexchat_thread_participants")
        .select("thread_id")
        .eq("email", first);
      if (firstError) throw firstError;

      const { data: secondRows, error: secondError } = await admin
        .from("knexchat_thread_participants")
        .select("thread_id")
        .eq("email", second);
      if (secondError) throw secondError;

      const firstIds = new Set((firstRows ?? []).map((row) => row.thread_id));
      const sharedIds = Array.from(new Set((secondRows ?? []).map((row) => row.thread_id))).filter((id) =>
        firstIds.has(id),
      );

      if (sharedIds.length) {
        const { data: existingThreads, error: existingError } = await admin
          .from("knexchat_threads")
          .select("id, kind, title, created_by, created_at, updated_at, last_message_at")
          .in("id", sharedIds)
          .eq("kind", "direct")
          .limit(1);

        if (existingError) throw existingError;

        const existing = existingThreads?.[0];
        if (existing) {
          const { data: participantData, error: participantError } = await admin
            .from("knexchat_thread_participants")
            .select("email, role")
            .eq("thread_id", existing.id);
          if (participantError) throw participantError;

          const participantsByThread = await attachParticipantNames(
            { [existing.id]: participantData ?? [] },
            [existing.id],
          );

          return Response.json(
            {
              thread: {
                ...existing,
                participants: participantsByThread[existing.id] ?? [],
              },
            },
            { status: 200 },
          );
        }
      }
    }

    const { data: thread, error: threadError } = await admin
      .from("knexchat_threads")
      .insert({
        kind: kindRaw,
        title,
        created_by: createdBy,
      })
      .select("id, kind, title, created_by, created_at, updated_at, last_message_at")
      .single();

    if (threadError) throw threadError;

    const adminRaw = Array.isArray(body?.admins) ? body.admins : [];
    const adminSet = new Set(uniqueEmails(adminRaw));
    if (!adminSet.size && kindRaw !== "direct") {
      adminSet.add(createdBy);
    }

    const participantRows = participants.map((email) => ({
      thread_id: thread.id,
      email,
      role: adminSet.has(email) ? "admin" : "member",
    }));

    const { error: participantsInsertError } = await admin
      .from("knexchat_thread_participants")
      .insert(participantRows);

    if (participantsInsertError) {
      await admin.from("knexchat_threads").delete().eq("id", thread.id);
      throw participantsInsertError;
    }

    return Response.json(
      {
        thread: {
          ...thread,
          participants: participantRows.map((row) => ({ email: row.email, role: row.role })),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return Response.json({ message: "Insert failed" }, { status: 500 });
  }
}
