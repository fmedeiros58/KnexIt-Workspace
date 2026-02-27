import { NextRequest } from "next/server";
import { getKnexchatAdmin, requireActivationAuth } from "@/app/api/knexchat/_activation";
import {
  NICKNAME_MAX,
  isReservedNickname,
  normalizeNickname,
  validateNickname,
} from "@/lib/knexchat/nickname";

export const runtime = "nodejs";

const randomSuffix = () => Math.random().toString(36).slice(2, 6);

const sanitizeBase = (value: string) =>
  normalizeNickname(value).replace(/[^a-z0-9._]/g, "");

const buildCandidate = (base: string, suffix?: string) => {
  const cleanBase = sanitizeBase(base);
  if (!suffix) return cleanBase.slice(0, NICKNAME_MAX);
  const maxBase = Math.max(1, NICKNAME_MAX - suffix.length);
  return `${cleanBase.slice(0, maxBase)}${suffix}`;
};

const isReservedInDb = async (
  admin: ReturnType<typeof getKnexchatAdmin>,
  value: string,
) => {
  if (!admin) return false;
  const { data, error } = await admin
    .from("knexchat_reserved_nicknames")
    .select("nickname_normalized")
    .eq("nickname_normalized", value)
    .limit(1);
  if (error) return false;
  return Boolean(data && data.length);
};

const isAvailable = async (admin: ReturnType<typeof getKnexchatAdmin>, value: string) => {
  if (!admin) return false;
  if (!value) return false;
  if (isReservedNickname(value) || (await isReservedInDb(admin, value))) return false;
  const { data, error } = await admin
    .from("knexchat_profiles")
    .select("user_id")
    .eq("nickname_normalized", value)
    .limit(1);
  if (error) return false;
  return !(data && data.length);
};

export async function POST(req: NextRequest) {
  const auth = await requireActivationAuth(req);
  if (auth.response) return auth.response;
  const admin = getKnexchatAdmin();
  if (!admin) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const baseRaw = typeof body?.base === "string" ? body.base : "";
  const fallbackBase = auth.user?.name || auth.user?.email.split("@")[0] || "knexchat";
  const seed = baseRaw || fallbackBase;
  const normalizedSeed = sanitizeBase(seed) || "knexchat";
  const validation = validateNickname(normalizedSeed);
  const safeBase = validation.ok ? normalizedSeed : "knexchat";

  const suggestions: string[] = [];
  const pushIfAvailable = async (candidate: string) => {
    if (suggestions.length >= 3) return;
    const valid = validateNickname(candidate);
    if (!valid.ok) return;
    if (suggestions.includes(valid.normalized)) return;
    if (await isAvailable(admin, valid.normalized)) {
      suggestions.push(valid.normalized);
    }
  };

  await pushIfAvailable(safeBase);
  for (let i = 1; i <= 3 && suggestions.length < 3; i += 1) {
    await pushIfAvailable(buildCandidate(safeBase, `${i}`));
  }
  let attempts = 0;
  while (suggestions.length < 3 && attempts < 10) {
    attempts += 1;
    const candidate = buildCandidate(safeBase, `_${randomSuffix()}`);
    await pushIfAvailable(candidate);
  }

  return Response.json({ suggestions }, { status: 200 });
}
