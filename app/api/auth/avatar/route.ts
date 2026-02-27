import { NextRequest } from "next/server";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";
import { getSupabaseAdmin } from "@/app/api/knexchat/_auth";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BUCKET_NAME = "avatars";
const identityUrl = process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const knexchatUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const identityServiceRole = process.env.IDENTITY_SUPABASE_SERVICE_ROLE_KEY || "";
const knexchatServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const shouldMirrorToKnexchatProject =
  Boolean(knexchatUrl && knexchatServiceRole) &&
  (identityUrl !== knexchatUrl || identityServiceRole !== knexchatServiceRole);

type TokenPayload = {
  sub?: string;
};

const decodeJwtPayload = (token: string): TokenPayload | null => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  try {
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function ensureBucket(admin: ReturnType<typeof identitySupabaseAdmin>) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) {
    throw error;
  }
  const exists = buckets?.some((bucket) => bucket.id === BUCKET_NAME || bucket.name === BUCKET_NAME);
  if (exists) return;
  const { error: createError } = await admin.storage.createBucket(BUCKET_NAME, { public: true });
  if (createError && !/exists/i.test(createError.message)) {
    throw createError;
  }
}

type AvatarSyncClient = SupabaseClient;

const syncAvatarAcrossClients = async ({
  clients,
  userId,
  userEmail,
  avatarUrl,
}: {
  clients: AvatarSyncClient[];
  userId: string;
  userEmail: string | null;
  avatarUrl: string;
}) => {
  const metadataPatch = {
    avatar_url: avatarUrl,
    picture: avatarUrl,
    avatar: avatarUrl,
  };

  await Promise.all(
    clients.map(async (client) => {
      try {
        await client.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
      } catch {
        // Ignore profile sync failures.
      }

      if (userEmail) {
        try {
          await client.from("knexchat_directory").upsert({ email: userEmail, avatar_url: avatarUrl }, { onConflict: "email" });
        } catch {
          // Ignore KnexChat directory sync failures.
        }
      }

      try {
        const { data: authUserData, error: authUserError } = await client.auth.admin.getUserById(userId);
        if (authUserError) return;
        const existingMetadata =
          ((authUserData?.user?.user_metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
        const nextMetadata = {
          ...existingMetadata,
          ...metadataPatch,
        };
        await client.auth.admin.updateUserById(userId, { user_metadata: nextMetadata });
      } catch {
        // Ignore auth metadata sync failures.
      }
    }),
  );
};

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return Response.json({ message: "Sessão inválida." }, { status: 401 });
    }

    let admin;
    try {
      admin = identitySupabaseAdmin();
    } catch (err) {
      return Response.json({ message: "Identity service role not configured." }, { status: 500 });
    }

    let userId: string | null = null;
    let userEmail: string | null = null;
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (!userError && userData?.user) {
      userId = userData.user.id;
      userEmail = userData.user.email?.toLowerCase() ?? null;
    } else {
      const payload = decodeJwtPayload(token);
      const sub = payload?.sub;
      if (!sub || !isUuid(sub)) {
        return Response.json({ message: "Sessão inválida." }, { status: 401 });
      }
      const { data: byId, error: byIdError } = await admin.auth.admin.getUserById(sub);
      if (byIdError || !byId?.user) {
        return Response.json({ message: "Sessão inválida." }, { status: 401 });
      }
      userId = byId.user.id;
      userEmail = byId.user.email?.toLowerCase() ?? null;
    }

    await ensureBucket(admin);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ message: "Arquivo inválido." }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ message: "Sessão inválida." }, { status: 401 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const filePath = userId;

    const { error: uploadError } = await admin.storage.from(BUCKET_NAME).upload(filePath, bytes, {
      upsert: true,
      contentType: file.type || "image/png",
      cacheControl: "3600",
    });

    if (uploadError) {
      return Response.json({ message: uploadError.message }, { status: 500 });
    }

    const { data: publicData } = admin.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    const avatarUrl = `${publicData.publicUrl}?t=${Date.now()}`;

    const syncClients: AvatarSyncClient[] = [admin];
    const knexchatAdmin = shouldMirrorToKnexchatProject ? getSupabaseAdmin() : null;
    if (knexchatAdmin) {
      syncClients.push(knexchatAdmin as AvatarSyncClient);
    }

    await syncAvatarAcrossClients({
      clients: syncClients,
      userId,
      userEmail,
      avatarUrl,
    });

    return Response.json({ url: avatarUrl }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar a imagem.";
    return Response.json({ message }, { status: 500 });
  }
}
