import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const KNEXCHAT_PUBLIC_BUCKET = "knexchat-public";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const toVersionTag = (value?: string | null) => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) return String(timestamp);
  return value;
};

const appendVersion = (url: string, version?: string | null) => {
  if (!url || !version) return url || null;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("v", version);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(version)}`;
  }
};

export async function getUserIdByEmail(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) return null;

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

export async function getUserAvatarUrl(
  admin: SupabaseClient<Database>,
  userId: string,
  fallbackDirectoryAvatar?: string | null,
): Promise<string | null> {
  if (!userId) return fallbackDirectoryAvatar ?? null;

  const { data: profile, error: profileError } = await admin
    .from("knexchat_profiles")
    .select("current_avatar_media_id, avatar_updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return fallbackDirectoryAvatar ?? null;
  }

  const currentMediaId = profile?.current_avatar_media_id ?? null;
  const avatarUpdatedAt = profile?.avatar_updated_at ?? null;

  if (currentMediaId) {
    const { data: media, error: mediaError } = await admin
      .from("knexchat_media_objects")
      .select("id, bucket, object_path, created_at")
      .eq("id", currentMediaId)
      .maybeSingle();

    if (!mediaError && media) {
      const version = toVersionTag(avatarUpdatedAt ?? media.created_at ?? null);
      if (media.bucket === KNEXCHAT_PUBLIC_BUCKET) {
        const stablePath = `u/${userId}/avatar/current.webp`;
        const { data: publicData } = admin.storage.from(KNEXCHAT_PUBLIC_BUCKET).getPublicUrl(stablePath);
        return appendVersion(publicData.publicUrl, version);
      }

      const { data: objectData } = admin.storage.from(media.bucket).getPublicUrl(media.object_path);
      return appendVersion(objectData.publicUrl, version);
    }
  }

  const version = toVersionTag(avatarUpdatedAt);
  return appendVersion(fallbackDirectoryAvatar ?? "", version);
}
