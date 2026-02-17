import { NextRequest } from "next/server";
import { getSupabaseAdmin, requireKnexchatEntitlement } from "@/app/api/knexchat/_auth";
import { getUserAvatarUrl } from "@/lib/knexchat/avatar";

export const runtime = "nodejs";

const KNEXCHAT_PUBLIC_BUCKET = "knexchat-public";

const avatarObjectPathForUser = (userId: string) => `u/${userId}/avatar/current.webp`;

const appendVersion = (url: string, version: string) => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

async function ensureBucket(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;
  const exists = buckets?.some((bucket) => bucket.id === KNEXCHAT_PUBLIC_BUCKET || bucket.name === KNEXCHAT_PUBLIC_BUCKET);
  if (exists) return;

  const { error: createError } = await admin.storage.createBucket(KNEXCHAT_PUBLIC_BUCKET, { public: true });
  if (createError && !/exists/i.test(createError.message)) {
    throw createError;
  }
}

export async function POST(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;

  const userId = entitlement.user?.userId ?? "";
  const email = entitlement.user?.email ?? "";
  if (!userId || !email) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ message: "Invalid file" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return Response.json({ message: "Only image uploads are supported" }, { status: 400 });
    }

    await ensureBucket(admin);

    const objectPath = avatarObjectPathForUser(userId);
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(KNEXCHAT_PUBLIC_BUCKET).upload(objectPath, bytes, {
      upsert: true,
      contentType: file.type || "image/webp",
      cacheControl: "3600",
    });
    if (uploadError) throw uploadError;

    const avatarUpdatedAt = new Date().toISOString();

    const { data: mediaObject, error: mediaObjectError } = await admin
      .from("knexchat_media_objects")
      .upsert(
        {
          owner_user_id: userId,
          bucket: KNEXCHAT_PUBLIC_BUCKET,
          object_path: objectPath,
          kind: "image",
          mime_type: file.type || "image/webp",
          size_bytes: file.size,
        },
        { onConflict: "bucket,object_path" },
      )
      .select("id, created_at")
      .single();
    if (mediaObjectError) throw mediaObjectError;

    const { error: profileUpdateError } = await admin
      .from("knexchat_profiles")
      .update({
        current_avatar_media_id: mediaObject.id,
        avatar_updated_at: avatarUpdatedAt,
      })
      .eq("user_id", userId);
    if (profileUpdateError) throw profileUpdateError;

    const { error: markPreviousNotCurrentError } = await admin
      .from("knexchat_profile_photos")
      .update({ is_current: false })
      .eq("user_id", userId)
      .eq("is_current", true);
    if (markPreviousNotCurrentError) throw markPreviousNotCurrentError;

    const { error: profilePhotoUpsertError } = await admin.from("knexchat_profile_photos").upsert(
      {
        user_id: userId,
        media_id: mediaObject.id,
        is_current: true,
      },
      { onConflict: "user_id,media_id" },
    );
    if (profilePhotoUpsertError) throw profilePhotoUpsertError;

    const { error: clearNonCurrentError } = await admin
      .from("knexchat_profile_photos")
      .update({ is_current: false })
      .eq("user_id", userId)
      .neq("media_id", mediaObject.id);
    if (clearNonCurrentError) throw clearNonCurrentError;

    const avatarUrlFromResolver = await getUserAvatarUrl(admin, userId, null);
    const stablePublic = admin.storage.from(KNEXCHAT_PUBLIC_BUCKET).getPublicUrl(objectPath).data.publicUrl;
    const fallbackVersioned = appendVersion(stablePublic, String(Date.parse(avatarUpdatedAt)));
    const avatarUrl = avatarUrlFromResolver ?? fallbackVersioned;

    const { error: directoryUpdateError } = await admin
      .from("knexchat_directory")
      .upsert({ email, avatar_url: avatarUrl }, { onConflict: "email" });
    if (directoryUpdateError) throw directoryUpdateError;

    return Response.json(
      {
        ok: true,
        avatar_url: avatarUrl,
        media_id: mediaObject.id,
        object_path: objectPath,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Avatar upload failed";
    return Response.json({ message }, { status: 500 });
  }
}
