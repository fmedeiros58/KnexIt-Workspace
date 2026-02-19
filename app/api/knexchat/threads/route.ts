import { NextRequest } from "next/server";
import { getSupabaseAdmin, requireKnexchatEntitlement } from "@/app/api/knexchat/_auth";
import { getUserAvatarUrl, getUserIdByEmail } from "@/lib/knexchat/avatar";

export const runtime = "nodejs";

const allowedKinds = new Set(["direct", "group", "forum"]);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => Boolean(value) && value.includes("@");

type ThreadParticipant = {
  email: string;
  role: string;
  name?: string | null;
  avatar_url?: string | null;
};

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
    .select("email, name, avatar_url")
    .in("email", Array.from(allEmails));

  if (error) throw error;

  const nameByEmail = new Map<string, string | null>();
  const directoryAvatarByEmail = new Map<string, string | null>();
  (directoryRows ?? []).forEach((row) => {
    nameByEmail.set(row.email, row.name ?? null);
    directoryAvatarByEmail.set(row.email, row.avatar_url ?? null);
  });

  const userIdByEmail = new Map<string, string>();
  try {
    const { data: profileRows, error: profileError } = await admin
      .from("profiles")
      .select("id, email")
      .in("email", Array.from(allEmails));
    if (!profileError) {
      (profileRows ?? []).forEach((row) => {
        if (!row.email || !row.id) return;
        userIdByEmail.set(row.email, row.id);
      });
    }
  } catch {
    // Best-effort only; legacy fallback remains available.
  }

  const avatarByEmail = new Map<string, string | null>();
  const avatarByUserId = new Map<string, string | null>();
  await Promise.all(
    Array.from(allEmails).map(async (email) => {
      const fallbackAvatar = directoryAvatarByEmail.get(email) ?? null;
      let userId = userIdByEmail.get(email) ?? null;
      if (!userId) {
        userId = await getUserIdByEmail(admin, email);
      }
      if (!userId) {
        avatarByEmail.set(email, fallbackAvatar);
        return;
      }
      if (!avatarByUserId.has(userId)) {
        try {
          const resolved = await getUserAvatarUrl(admin, userId, fallbackAvatar);
          avatarByUserId.set(userId, resolved ?? fallbackAvatar);
        } catch {
          avatarByUserId.set(userId, fallbackAvatar);
        }
      }
      avatarByEmail.set(email, avatarByUserId.get(userId) ?? fallbackAvatar);
    }),
  );

  const next: Record<string, ThreadParticipant[]> = {};
  threadIds.forEach((threadId) => {
    next[threadId] = (participantsByThread[threadId] ?? []).map((participant) => ({
      ...participant,
      name: nameByEmail.get(participant.email) ?? null,
      avatar_url: avatarByEmail.get(participant.email) ?? null,
    }));
  });

  return next;
}

async function loadThreadWithParticipants(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, threadId: string) {
  const { data: existing, error: existingError } = await admin
    .from("knexchat_threads")
    .select("id, kind, title, created_by, created_at, updated_at, last_message_at")
    .eq("id", threadId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return null;

  const { data: participantData, error: participantError } = await admin
    .from("knexchat_thread_participants")
    .select("email, role")
    .eq("thread_id", existing.id);
  if (participantError) throw participantError;

  const participantsByThread = await attachParticipantNames(
    { [existing.id]: participantData ?? [] },
    [existing.id],
  );
  return {
    ...existing,
    participants: participantsByThread[existing.id] ?? [],
  };
}

async function findLegacyDirectThreadId(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  firstEmail: string,
  secondEmail: string,
) {
  const { data: firstRows, error: firstError } = await admin
    .from("knexchat_thread_participants")
    .select("thread_id")
    .eq("email", firstEmail);
  if (firstError) throw firstError;

  const { data: secondRows, error: secondError } = await admin
    .from("knexchat_thread_participants")
    .select("thread_id")
    .eq("email", secondEmail);
  if (secondError) throw secondError;

  const firstIds = new Set((firstRows ?? []).map((row) => row.thread_id));
  const sharedIds = Array.from(new Set((secondRows ?? []).map((row) => row.thread_id))).filter((id) =>
    firstIds.has(id),
  );
  if (!sharedIds.length) return null;

  const { data: existingThreads, error: existingError } = await admin
    .from("knexchat_threads")
    .select("id")
    .in("id", sharedIds)
    .eq("kind", "direct")
    .limit(1);
  if (existingError) throw existingError;

  return existingThreads?.[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;
  const authEmail = normalizeEmail(entitlement.user?.email ?? "");
  const { searchParams } = new URL(req.url);
  const emailParam = searchParams.get("email");
  const email = emailParam ? normalizeEmail(emailParam) : normalizeEmail(authEmail);
  if (!isValidEmail(email)) {
    return Response.json({ message: "Invalid email" }, { status: 400 });
  }
  if (emailParam && email !== authEmail) {
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
    let participantsByThread: Record<string, ThreadParticipant[]> = {};
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
  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;
  const authEmail = normalizeEmail(entitlement.user?.email ?? "");
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

    let directPair: { userA: string; userB: string } | null = null;
    if (kindRaw === "direct" && participants.length === 2) {
      const [first, second] = participants;
      const [firstUserId, secondUserId] = await Promise.all([
        getUserIdByEmail(admin, first),
        getUserIdByEmail(admin, second),
      ]);

      if (firstUserId && secondUserId && firstUserId !== secondUserId) {
        const [userA, userB] =
          firstUserId < secondUserId ? [firstUserId, secondUserId] : [secondUserId, firstUserId];
        directPair = { userA, userB };

        const { data: mappedDirectThread, error: mappedDirectThreadError } = await admin
          .from("knexchat_direct_threads")
          .select("thread_id")
          .eq("user_a", userA)
          .eq("user_b", userB)
          .maybeSingle();
        if (mappedDirectThreadError) throw mappedDirectThreadError;

        if (mappedDirectThread?.thread_id) {
          const existing = await loadThreadWithParticipants(admin, mappedDirectThread.thread_id);
          if (existing) {
            return Response.json({ thread: existing }, { status: 200 });
          }
        }

        const legacyDirectThreadId = await findLegacyDirectThreadId(admin, first, second);
        if (legacyDirectThreadId) {
          await admin.from("knexchat_direct_threads").upsert(
            {
              user_a: userA,
              user_b: userB,
              thread_id: legacyDirectThreadId,
            },
            { onConflict: "user_a,user_b" },
          );

          const existing = await loadThreadWithParticipants(admin, legacyDirectThreadId);
          if (existing) {
            return Response.json({ thread: existing }, { status: 200 });
          }
        }
      } else {
        const legacyDirectThreadId = await findLegacyDirectThreadId(admin, first, second);
        if (legacyDirectThreadId) {
          const existing = await loadThreadWithParticipants(admin, legacyDirectThreadId);
          if (existing) {
            return Response.json({ thread: existing }, { status: 200 });
          }
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

    if (directPair) {
      const { error: directPairInsertError } = await admin.from("knexchat_direct_threads").insert({
        user_a: directPair.userA,
        user_b: directPair.userB,
        thread_id: thread.id,
      });

      if (directPairInsertError) {
        const { data: mappedDirectThread, error: mappedDirectThreadError } = await admin
          .from("knexchat_direct_threads")
          .select("thread_id")
          .eq("user_a", directPair.userA)
          .eq("user_b", directPair.userB)
          .maybeSingle();
        if (mappedDirectThreadError) throw mappedDirectThreadError;

        if (mappedDirectThread?.thread_id && mappedDirectThread.thread_id !== thread.id) {
          await admin.from("knexchat_threads").delete().eq("id", thread.id);
          const existing = await loadThreadWithParticipants(admin, mappedDirectThread.thread_id);
          if (existing) {
            return Response.json({ thread: existing }, { status: 200 });
          }
        } else if (!mappedDirectThread?.thread_id) {
          throw directPairInsertError;
        }
      }
    }

    const participantsByThread = await attachParticipantNames(
      {
        [thread.id]: participantRows.map((row) => ({ email: row.email, role: row.role })),
      },
      [thread.id],
    );

    return Response.json(
      {
        thread: {
          ...thread,
          participants: participantsByThread[thread.id] ?? participantRows.map((row) => ({ email: row.email, role: row.role })),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return Response.json({ message: "Insert failed" }, { status: 500 });
  }
}
