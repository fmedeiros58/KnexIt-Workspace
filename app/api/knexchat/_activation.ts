import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";
import { extractBearerToken } from "@/lib/identityAuth";
import { getSupabaseAdmin } from "@/app/api/knexchat/_auth";

export type ActivationAuthUser = {
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
};

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as {
      email?: string;
      user_metadata?: { email?: string };
    };
  } catch {
    return null;
  }
};

const sanitizeAvatarUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
};

export const requireActivationAuth = async (req: Request) => {
  const token = extractBearerToken(req);
  if (!token) {
    return { user: null, token: null, response: Response.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  let admin;
  try {
    admin = identitySupabaseAdmin();
  } catch (error) {
    return { user: null, token: null, response: Response.json({ message: "Auth unavailable" }, { status: 500 }) };
  }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { user: null, token: null, response: Response.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  const payload = decodeJwtPayload(token);
  const email =
    data.user.email?.trim() ||
    payload?.email?.trim() ||
    payload?.user_metadata?.email?.trim() ||
    "";
  if (!email) {
    return { user: null, token: null, response: Response.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  const metadata = data.user.user_metadata as {
    name?: string;
    full_name?: string;
    avatar_url?: string;
    picture?: string;
    avatar?: string;
  } | null;
  const nameRaw = metadata?.name || metadata?.full_name || "";
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : undefined;
  let avatarUrl = sanitizeAvatarUrl(metadata?.avatar_url ?? metadata?.picture ?? metadata?.avatar ?? "");
  if (!avatarUrl) {
    try {
      const knexchatAdmin = getSupabaseAdmin();
      if (knexchatAdmin) {
        const { data: profileRow, error: profileError } = await knexchatAdmin
          .from("profiles")
          .select("avatar_url")
          .eq("id", data.user.id)
          .maybeSingle();
        if (!profileError) {
          avatarUrl = sanitizeAvatarUrl((profileRow as { avatar_url?: string | null } | null)?.avatar_url ?? "");
        }
      }
    } catch {
      // Ignore fallback avatar lookup failures.
    }
  }
  return {
    user: { userId: data.user.id, email: email.toLowerCase(), name, avatarUrl },
    token,
    response: null,
  };
};

export const getKnexchatAdmin = () => getSupabaseAdmin();

