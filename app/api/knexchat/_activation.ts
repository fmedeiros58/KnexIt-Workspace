import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";
import { extractBearerToken } from "@/lib/identityAuth";
import { getSupabaseAdmin } from "@/app/api/knexchat/_auth";

export type ActivationAuthUser = {
  userId: string;
  email: string;
  name?: string;
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
  const email = data.user.email ?? "";
  if (!email) {
    return { user: null, token: null, response: Response.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  const metadata = data.user.user_metadata as { name?: string; full_name?: string } | null;
  const nameRaw = metadata?.name || metadata?.full_name || "";
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : undefined;
  return {
    user: { userId: data.user.id, email: email.toLowerCase(), name },
    token,
    response: null,
  };
};

export const getKnexchatAdmin = () => getSupabaseAdmin();

