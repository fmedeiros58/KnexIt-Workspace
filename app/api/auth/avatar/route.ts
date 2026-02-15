import { NextRequest } from "next/server";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";

export const runtime = "nodejs";

const BUCKET_NAME = "avatars";

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
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (!userError && userData?.user) {
      userId = userData.user.id;
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
    }

    await ensureBucket(admin);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ message: "Arquivo inválido." }, { status: 400 });
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

    return Response.json({ url: avatarUrl }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar a imagem.";
    return Response.json({ message }, { status: 500 });
  }
}
