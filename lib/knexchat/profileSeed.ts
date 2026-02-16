export type IdentityMetadata = {
  name?: string;
  full_name?: string;
  avatar_url?: string;
  picture?: string;
  avatar?: string;
} | null;

export type KnexchatProfileSeed = {
  avatarUrl?: string;
  displayName?: string;
  source?: "ecosystem";
  createdAt?: string;
};

const PROFILE_SEED_PREFIX = "knexchat.profile.seed.v1:";
const KNEXCHAT_PREFERENCES_PREFIX = "knexchat.preferences.v1:";

const sanitizeUrl = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "";
};

export const getKnexchatProfileSeedKey = (userId: string) => `${PROFILE_SEED_PREFIX}${userId}`;
export const getKnexchatPreferencesKey = (userId: string) => `${KNEXCHAT_PREFERENCES_PREFIX}${userId}`;

export const resolveIdentityDisplayName = (metadata: IdentityMetadata, fallbackEmail = "") => {
  const candidate = String(metadata?.full_name ?? metadata?.name ?? "").trim();
  if (candidate) return candidate;
  const local = fallbackEmail.split("@")[0] ?? "";
  return local.replace(/[._-]+/g, " ").trim();
};

export const resolveIdentityAvatarUrl = (metadata: IdentityMetadata) =>
  sanitizeUrl(String(metadata?.avatar_url ?? metadata?.picture ?? metadata?.avatar ?? ""));

export const writeKnexchatProfileSeed = (userId: string, seed: KnexchatProfileSeed) => {
  if (typeof window === "undefined") return;
  if (!userId) return;
  try {
    window.localStorage.setItem(getKnexchatProfileSeedKey(userId), JSON.stringify(seed));
  } catch {
    // Ignore storage write errors.
  }
};

export const readKnexchatProfileSeed = (userId: string): KnexchatProfileSeed | null => {
  if (typeof window === "undefined") return null;
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(getKnexchatProfileSeedKey(userId));
    if (!raw || !raw.trim()) return null;
    const parsed = JSON.parse(raw) as KnexchatProfileSeed | null;
    if (!parsed || typeof parsed !== "object") return null;
    const avatarUrl = sanitizeUrl(String(parsed.avatarUrl ?? ""));
    const displayName = String(parsed.displayName ?? "").trim();
    return {
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(displayName ? { displayName } : {}),
      source: parsed.source === "ecosystem" ? "ecosystem" : undefined,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
    };
  } catch {
    return null;
  }
};

export const consumeKnexchatProfileSeed = (userId: string) => {
  const seed = readKnexchatProfileSeed(userId);
  if (typeof window !== "undefined" && userId) {
    try {
      window.localStorage.removeItem(getKnexchatProfileSeedKey(userId));
    } catch {
      // Ignore storage remove errors.
    }
  }
  return seed;
};
