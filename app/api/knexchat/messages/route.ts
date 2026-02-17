import { NextRequest } from "next/server";
import { getSupabaseAdmin, requireKnexchatEntitlement } from "@/app/api/knexchat/_auth";

export const runtime = "nodejs";

const allowedKinds = new Set(["text", "image", "audio", "file"]);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => Boolean(value) && value.includes("@");
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AttachmentPayload = {
  media_id: string;
  kind?: "image" | "video" | "audio" | "file";
  caption?: string;
  sort_order?: number;
};

export async function GET(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;
  const authEmail = entitlement.user?.email ?? "";
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

    const messages = data ?? [];
    const messageIds = messages.map((message) => message.id);
    if (!messageIds.length) {
      return Response.json({ messages }, { status: 200 });
    }

    const { data: attachmentRows, error: attachmentsError } = await admin
      .from("knexchat_message_attachments")
      .select(
        "id, message_id, media_id, kind, caption, sort_order, created_at, media:knexchat_media_objects(bucket, object_path, mime_type, size_bytes, width, height, duration_ms)",
      )
      .in("message_id", messageIds)
      .order("sort_order", { ascending: true });
    if (attachmentsError) throw attachmentsError;

    const attachmentsByMessage = new Map<string, unknown[]>();
    (attachmentRows ?? []).forEach((row) => {
      const media = Array.isArray(row.media) ? row.media[0] : row.media;
      const bucket = media?.bucket ?? null;
      const objectPath = media?.object_path ?? null;
      const isPublic = bucket === "knexchat-public";
      const publicUrl =
        isPublic && bucket && objectPath ? admin.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl : null;
      const current = attachmentsByMessage.get(row.message_id) ?? [];
      current.push({
        id: row.id,
        media_id: row.media_id,
        kind: row.kind,
        caption: row.caption ?? null,
        sort_order: row.sort_order ?? 0,
        created_at: row.created_at,
        bucket,
        object_path: objectPath,
        url: publicUrl,
        mime_type: media?.mime_type ?? null,
        size_bytes: media?.size_bytes ?? null,
        width: media?.width ?? null,
        height: media?.height ?? null,
        duration_ms: media?.duration_ms ?? null,
      });
      attachmentsByMessage.set(row.message_id, current);
    });

    const enrichedMessages = messages.map((message) => ({
      ...message,
      attachments: attachmentsByMessage.get(message.id) ?? [],
    }));

    return Response.json({ messages: enrichedMessages }, { status: 200 });
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
    const threadId = typeof body?.threadId === "string" ? body.threadId : "";
    const senderRaw = typeof body?.senderEmail === "string" ? body.senderEmail : "";
    const senderEmail = normalizeEmail(senderRaw);
    const kindRaw = typeof body?.kind === "string" ? body.kind : "text";
    const messageBody = typeof body?.body === "string" ? body.body.trim() : "";
    const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl.trim() : "";
    const mediaName = typeof body?.mediaName === "string" ? body.mediaName.trim() : "";
    const attachmentsRaw = Array.isArray(body?.attachments) ? body.attachments : [];
    const attachments: AttachmentPayload[] = [];

    for (let index = 0; index < attachmentsRaw.length; index += 1) {
      const item = attachmentsRaw[index];
      if (!item || typeof item !== "object") {
        return Response.json({ message: "Invalid attachment payload" }, { status: 400 });
      }
      const mediaId = typeof item.media_id === "string" ? item.media_id : "";
      const attachmentKind = typeof item.kind === "string" ? item.kind : undefined;
      const caption = typeof item.caption === "string" ? item.caption.trim() : undefined;
      const sortOrderRaw = Number((item as { sort_order?: number | string }).sort_order ?? index);
      if (!uuidRegex.test(mediaId)) {
        return Response.json({ message: "Invalid attachment media_id" }, { status: 400 });
      }
      if (attachmentKind && !["image", "video", "audio", "file"].includes(attachmentKind)) {
        return Response.json({ message: "Invalid attachment kind" }, { status: 400 });
      }
      attachments.push({
        media_id: mediaId,
        kind: attachmentKind as AttachmentPayload["kind"],
        caption: caption || undefined,
        sort_order: Number.isFinite(sortOrderRaw) ? Math.max(0, Math.trunc(sortOrderRaw)) : index,
      });
    }

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

    if (kindRaw === "text" && !messageBody && !attachments.length) {
      return Response.json({ message: "Message body required" }, { status: 400 });
    }

    if (kindRaw !== "text" && !mediaUrl && !attachments.length) {
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

    if (attachments.length) {
      const attachmentRows = attachments.map((attachment, index) => ({
        message_id: message.id,
        media_id: attachment.media_id,
        kind: attachment.kind ?? (kindRaw === "text" ? "file" : (kindRaw as "image" | "audio" | "file")),
        caption: attachment.caption ?? null,
        sort_order: attachment.sort_order ?? index,
      }));

      const { error: attachmentsInsertError } = await admin
        .from("knexchat_message_attachments")
        .insert(attachmentRows);
      if (attachmentsInsertError) {
        await admin.from("knexchat_messages").delete().eq("id", message.id);
        throw attachmentsInsertError;
      }
    }

    const { data: insertedAttachmentRows, error: insertedAttachmentsError } = await admin
      .from("knexchat_message_attachments")
      .select(
        "id, message_id, media_id, kind, caption, sort_order, created_at, media:knexchat_media_objects(bucket, object_path, mime_type, size_bytes, width, height, duration_ms)",
      )
      .eq("message_id", message.id)
      .order("sort_order", { ascending: true });
    if (insertedAttachmentsError) throw insertedAttachmentsError;

    const structuredAttachments = (insertedAttachmentRows ?? []).map((row) => {
      const media = Array.isArray(row.media) ? row.media[0] : row.media;
      const bucket = media?.bucket ?? null;
      const objectPath = media?.object_path ?? null;
      const isPublic = bucket === "knexchat-public";
      const publicUrl =
        isPublic && bucket && objectPath ? admin.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl : null;
      return {
        id: row.id,
        media_id: row.media_id,
        kind: row.kind,
        caption: row.caption ?? null,
        sort_order: row.sort_order ?? 0,
        created_at: row.created_at,
        bucket,
        object_path: objectPath,
        url: publicUrl,
        mime_type: media?.mime_type ?? null,
        size_bytes: media?.size_bytes ?? null,
        width: media?.width ?? null,
        height: media?.height ?? null,
        duration_ms: media?.duration_ms ?? null,
      };
    });

    return Response.json({ message: { ...message, attachments: structuredAttachments } }, { status: 201 });
  } catch (err) {
    return Response.json({ message: "Insert failed" }, { status: 500 });
  }
}
