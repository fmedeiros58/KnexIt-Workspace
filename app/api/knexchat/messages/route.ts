import { NextRequest } from "next/server";
import type { Database } from "@/types/supabase";
import { getSupabaseAdmin, requireKnexchatEntitlement } from "@/app/api/knexchat/_auth";

export const runtime = "nodejs";

const KNEXCHAT_PUBLIC_BUCKET = "knexchat-public";
const MAX_INLINE_MEDIA_BYTES = 25 * 1024 * 1024;
const allowedKinds = new Set(["text", "image", "audio", "file"]);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => Boolean(value) && value.includes("@");
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dataUrlRegex = /^data:([^;,]+)?(?:;(base64))?,([\s\S]*)$/i;

type MediaKind = Database["public"]["Enums"]["knexchat_media_kind"];
type MessageKind = "text" | "image" | "audio" | "file";

type AttachmentPayload = {
  media_id: string;
  kind?: MediaKind;
  caption?: string;
  sort_order?: number;
};

type MediaProjection = {
  bucket: string | null;
  object_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
};

type AttachmentSelectRow = {
  id: string;
  message_id: string;
  media_id: string;
  kind: MediaKind;
  caption: string | null;
  sort_order: number | null;
  created_at: string;
  media: MediaProjection | MediaProjection[] | null;
};

type StructuredAttachment = {
  id: string;
  media_id: string;
  kind: MediaKind;
  caption: string | null;
  sort_order: number;
  created_at: string;
  bucket: string | null;
  object_path: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
};

type InlineMediaPayload = {
  bytes: Buffer;
  mimeType: string;
  inferredKind: MediaKind;
  extension: string;
};

const mimeToKind = (mimeType: string): MediaKind => {
  const lower = mimeType.toLowerCase();
  if (lower.startsWith("image/")) return "image";
  if (lower.startsWith("video/")) return "video";
  if (lower.startsWith("audio/")) return "audio";
  return "file";
};

const extensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "application/pdf": "pdf",
};

const extensionFromMime = (mimeType: string) => {
  const lower = mimeType.toLowerCase();
  const known = extensionByMime[lower];
  if (known) return known;
  const slashIndex = lower.indexOf("/");
  if (slashIndex < 0) return "bin";
  const suffix = lower.slice(slashIndex + 1).split("+")[0].trim();
  if (!suffix) return "bin";
  const sanitized = suffix.replace(/[^a-z0-9]/gi, "");
  return sanitized || "bin";
};

const parseInlineMediaDataUrl = (value: string): InlineMediaPayload | null => {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("data:")) return null;
  const match = trimmed.match(dataUrlRegex);
  if (!match) return null;
  const mimeType = (match[1] || "application/octet-stream").trim().toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  let bytes: Buffer;
  try {
    bytes = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf-8");
  } catch {
    return null;
  }
  if (!bytes.length) return null;
  return {
    bytes,
    mimeType,
    inferredKind: mimeToKind(mimeType),
    extension: extensionFromMime(mimeType),
  };
};

const normalizeFileName = (rawName: string, extension: string) => {
  const baseName = rawName.split(/[\\/]/).pop() ?? "";
  const cleaned = baseName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

  if (!cleaned) return `media.${extension}`;
  if (/\.[a-z0-9]{2,10}$/i.test(cleaned)) return cleaned;
  return `${cleaned}.${extension}`;
};

const getAttachmentKindForMessage = (messageKind: MessageKind, inlineKind: MediaKind): MediaKind => {
  if (messageKind === "image") {
    return inlineKind === "video" ? "video" : "image";
  }
  if (messageKind === "audio") return "audio";
  if (messageKind === "file") return "file";
  return inlineKind;
};

const getMediaFromJoin = (row: AttachmentSelectRow): MediaProjection | null => {
  if (!row.media) return null;
  if (Array.isArray(row.media)) return row.media[0] ?? null;
  return row.media;
};

const toStructuredAttachment = (
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  row: AttachmentSelectRow,
): StructuredAttachment => {
  const media = getMediaFromJoin(row);
  const bucket = media?.bucket ?? null;
  const objectPath = media?.object_path ?? null;
  const isPublic = bucket === KNEXCHAT_PUBLIC_BUCKET;
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
};

const pickPrimaryAttachmentUrl = (attachments: StructuredAttachment[]) =>
  attachments.find((attachment) => typeof attachment.url === "string" && attachment.url)?.url ?? null;

async function ensurePublicBucket(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;
  const exists = buckets?.some((bucket) => bucket.id === KNEXCHAT_PUBLIC_BUCKET || bucket.name === KNEXCHAT_PUBLIC_BUCKET);
  if (exists) return;

  const { error: createError } = await admin.storage.createBucket(KNEXCHAT_PUBLIC_BUCKET, { public: true });
  if (createError && !/exists/i.test(createError.message)) {
    throw createError;
  }
}

export async function GET(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }
  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;
  const authEmail = normalizeEmail(entitlement.user?.email ?? "");
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

    const attachmentsByMessage = new Map<string, StructuredAttachment[]>();
    ((attachmentRows ?? []) as AttachmentSelectRow[]).forEach((row) => {
      const current = attachmentsByMessage.get(row.message_id) ?? [];
      current.push(toStructuredAttachment(admin, row));
      attachmentsByMessage.set(row.message_id, current);
    });

    const enrichedMessages = messages.map((message) => {
      const structuredAttachments = attachmentsByMessage.get(message.id) ?? [];
      const fallbackMediaUrl = pickPrimaryAttachmentUrl(structuredAttachments);
      return {
        ...message,
        media_url: message.media_url ?? fallbackMediaUrl,
        attachments: structuredAttachments,
      };
    });

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
  const authEmail = normalizeEmail(entitlement.user?.email ?? "");
  const authUserId = entitlement.user?.userId ?? "";
  if (!authUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const threadId = typeof body?.threadId === "string" ? body.threadId : "";
    const senderRaw = typeof body?.senderEmail === "string" ? body.senderEmail : "";
    const senderEmail = normalizeEmail(senderRaw);
    const kindRaw = (typeof body?.kind === "string" ? body.kind : "text") as MessageKind;
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

    if (mediaUrl && /^blob:/i.test(mediaUrl)) {
      return Response.json({ message: "Blob URLs are not supported for server messaging" }, { status: 400 });
    }

    let inlineMedia: InlineMediaPayload | null = null;
    if (mediaUrl.toLowerCase().startsWith("data:")) {
      inlineMedia = parseInlineMediaDataUrl(mediaUrl);
      if (!inlineMedia) {
        return Response.json({ message: "Invalid media data URL" }, { status: 400 });
      }
      if (inlineMedia.bytes.length > MAX_INLINE_MEDIA_BYTES) {
        return Response.json({ message: "Media too large" }, { status: 413 });
      }
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
        media_url: inlineMedia ? null : mediaUrl || null,
        media_name: mediaName || null,
      })
      .select("id, thread_id, sender_email, body, kind, media_url, media_name, created_at")
      .single();

    if (insertError) throw insertError;

    let uploadedInlineMedia:
      | { mediaId: string; objectPath: string; bucket: string; publicUrl: string; attachmentKind: MediaKind }
      | null = null;

    if (inlineMedia) {
      await ensurePublicBucket(admin);
      const fileName = normalizeFileName(mediaName || `media-${message.id}`, inlineMedia.extension);
      const objectPath = `u/${authUserId}/posts/${threadId}/${message.id}/${fileName}`;
      const { error: uploadError } = await admin.storage.from(KNEXCHAT_PUBLIC_BUCKET).upload(objectPath, inlineMedia.bytes, {
        contentType: inlineMedia.mimeType,
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        await admin.from("knexchat_messages").delete().eq("id", message.id);
        throw uploadError;
      }

      const attachmentKind = getAttachmentKindForMessage(kindRaw, inlineMedia.inferredKind);
      const { data: mediaObject, error: mediaObjectError } = await admin
        .from("knexchat_media_objects")
        .insert({
          owner_user_id: authUserId,
          bucket: KNEXCHAT_PUBLIC_BUCKET,
          object_path: objectPath,
          kind: attachmentKind,
          mime_type: inlineMedia.mimeType,
          size_bytes: inlineMedia.bytes.length,
        })
        .select("id")
        .single();

      if (mediaObjectError || !mediaObject?.id) {
        await admin.storage.from(KNEXCHAT_PUBLIC_BUCKET).remove([objectPath]);
        await admin.from("knexchat_messages").delete().eq("id", message.id);
        throw mediaObjectError ?? new Error("Failed to register uploaded media");
      }

      const publicUrl = admin.storage.from(KNEXCHAT_PUBLIC_BUCKET).getPublicUrl(objectPath).data.publicUrl;
      uploadedInlineMedia = {
        mediaId: mediaObject.id,
        objectPath,
        bucket: KNEXCHAT_PUBLIC_BUCKET,
        publicUrl,
        attachmentKind,
      };
    }

    const attachmentRowsToInsert = attachments.map((attachment, index) => ({
      message_id: message.id,
      media_id: attachment.media_id,
      kind: attachment.kind ?? (kindRaw === "text" ? "file" : (kindRaw as MediaKind)),
      caption: attachment.caption ?? null,
      sort_order: attachment.sort_order ?? index,
    }));

    if (uploadedInlineMedia) {
      attachmentRowsToInsert.push({
        message_id: message.id,
        media_id: uploadedInlineMedia.mediaId,
        kind: uploadedInlineMedia.attachmentKind,
        caption: null,
        sort_order: attachmentRowsToInsert.length,
      });
    }

    if (attachmentRowsToInsert.length) {
      const { error: attachmentsInsertError } = await admin.from("knexchat_message_attachments").insert(attachmentRowsToInsert);
      if (attachmentsInsertError) {
        if (uploadedInlineMedia) {
          await admin.storage.from(uploadedInlineMedia.bucket).remove([uploadedInlineMedia.objectPath]);
          await admin.from("knexchat_media_objects").delete().eq("id", uploadedInlineMedia.mediaId);
        }
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

    const structuredAttachments = ((insertedAttachmentRows ?? []) as AttachmentSelectRow[]).map((row) =>
      toStructuredAttachment(admin, row),
    );
    const fallbackMediaUrl = uploadedInlineMedia?.publicUrl ?? pickPrimaryAttachmentUrl(structuredAttachments);

    return Response.json(
      {
        message: {
          ...message,
          media_url: message.media_url ?? fallbackMediaUrl,
          attachments: structuredAttachments,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return Response.json({ message: "Insert failed" }, { status: 500 });
  }
}
