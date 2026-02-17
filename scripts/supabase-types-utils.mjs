import { execFileSync } from "node:child_process";

export const SUPABASE_TYPE_SANITY_MARKERS = [
  '"knexchat_directory"',
  '"knexchat_profiles"',
  '"knexchat_threads"',
  '"knexchat_messages"',
  '"knexchat_media_objects"',
  '"knexchat_profile_photos"',
  '"knexchat_message_attachments"',
  '"knexchat_direct_threads"',
  '"knexchat_message_receipts"',
  '"knexchat_message_reactions"',
];

const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";

export const normalizeEol = (value) => value.replace(/\r\n/g, "\n").trimEnd() + "\n";

export function resolveProjectRef(supabaseUrl, explicitProjectRef) {
  if (explicitProjectRef && explicitProjectRef.trim()) {
    return explicitProjectRef.trim();
  }

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  let parsed;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid.");
  }

  const host = parsed.hostname;
  if (host.endsWith(".supabase.co")) {
    return host.split(".")[0];
  }

  throw new Error(
    "Could not infer project ref from NEXT_PUBLIC_SUPABASE_URL. Set SUPABASE_PROJECT_ID explicitly.",
  );
}

export function generateSupabaseTypes({ projectRef, accessToken }) {
  const normalizedProjectRef = String(projectRef || "").trim();
  const normalizedAccessToken = String(accessToken || "").trim();

  if (!normalizedProjectRef) throw new Error("Supabase project ref is required.");
  if (!normalizedAccessToken) throw new Error("SUPABASE_ACCESS_TOKEN is required.");

  return execFileSync(
    NPX_BIN,
    [
      "supabase",
      "gen",
      "types",
      "typescript",
      "--project-id",
      normalizedProjectRef,
      "--schema",
      "public",
    ],
    {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      env: {
        ...process.env,
        SUPABASE_ACCESS_TOKEN: normalizedAccessToken,
      },
    },
  );
}

export function assertSupabaseTypeSanity(typesSource) {
  const missing = SUPABASE_TYPE_SANITY_MARKERS.filter((marker) => !typesSource.includes(marker));
  if (missing.length) {
    throw new Error(`Supabase types sanity-check failed. Missing markers: ${missing.join(", ")}`);
  }
}
