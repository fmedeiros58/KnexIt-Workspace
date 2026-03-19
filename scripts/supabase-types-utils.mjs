import { execFileSync } from "node:child_process";

export const SUPABASE_TYPE_SANITY_MARKERS = [
  "knexchat_directory",
  "knexchat_profiles",
  "knexchat_threads",
  "knexchat_messages",
  "knexchat_media_objects",
  "knexchat_profile_photos",
  "knexchat_message_attachments",
  "knexchat_direct_threads",
  "knexchat_message_receipts",
  "knexchat_message_reactions",
];

function getSupabaseGenCommand(projectRef) {
  const args = [
    "supabase",
    "gen",
    "types",
    "typescript",
    "--project-id",
    projectRef,
    "--schema",
    "public",
  ];

  // `execFileSync("npx.cmd", ...)` fails with EINVAL on recent Node/Windows.
  if (process.platform === "win32") {
    return {
      bin: "cmd.exe",
      args: ["/d", "/s", "/c", "npx", ...args],
    };
  }

  return { bin: "npx", args };
}

export const normalizeEol = (value) => value.replace(/\r\n/g, "\n").trimEnd() + "\n";

const PROJECT_REF_REGEX = /^[a-z0-9]{20}$/i;

function extractProjectRef(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (PROJECT_REF_REGEX.test(raw)) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname;
    if (host.endsWith(".supabase.co")) {
      const ref = host.split(".")[0];
      return PROJECT_REF_REGEX.test(ref) ? ref : "";
    }
  } catch {
    // Ignore parse errors and keep trying.
  }

  const normalized = raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (normalized.endsWith(".supabase.co")) {
    const ref = normalized.split(".")[0];
    return PROJECT_REF_REGEX.test(ref) ? ref : "";
  }

  return "";
}

export function resolveProjectRef(supabaseUrl, explicitProjectRef) {
  const explicit = extractProjectRef(explicitProjectRef);
  if (explicit) {
    return explicit;
  }

  const inferred = extractProjectRef(supabaseUrl);
  if (inferred) {
    return inferred;
  }

  const explicitRaw = String(explicitProjectRef || "").trim();
  if (explicitRaw) {
    throw new Error(
      "Invalid project ref format. Must be like abcdefghijklmnopqrst.",
    );
  }

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid.");
}

export function generateSupabaseTypes({ projectRef, accessToken }) {
  const normalizedProjectRef = String(projectRef || "").trim();
  const normalizedAccessToken = String(accessToken || "").trim();

  if (!normalizedProjectRef) throw new Error("Supabase project ref is required.");
  if (!normalizedAccessToken) throw new Error("SUPABASE_ACCESS_TOKEN is required.");
  const command = getSupabaseGenCommand(normalizedProjectRef);

  try {
    return execFileSync(
      command.bin,
      command.args,
      {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        env: {
          ...process.env,
          SUPABASE_ACCESS_TOKEN: normalizedAccessToken,
        },
      },
    );
  } catch (error) {
    const details = [
      String(error?.stdout || "").trim(),
      String(error?.stderr || "").trim(),
      String(error?.message || "").trim(),
    ]
      .filter(Boolean)
      .join("\n");

    if (/unauthorized|401|forbidden|permission/i.test(details)) {
      throw new Error(
        [
          `Supabase CLI returned unauthorized for project '${normalizedProjectRef}'.`,
          "Verify SUPABASE_ACCESS_TOKEN has access to this project and is not expired.",
          "If you use a custom project ref, set SUPABASE_PROJECT_ID or SUPABASE_PROJECT_REF correctly.",
          details ? `CLI output:\n${details}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    throw new Error(
      [
        `Failed to generate Supabase types for project '${normalizedProjectRef}'.`,
        details ? `CLI output:\n${details}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

export function assertSupabaseTypeSanity(typesSource) {
  const missing = SUPABASE_TYPE_SANITY_MARKERS.filter((marker) => {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const markerPattern = new RegExp(`(?:\"${escaped}\"|${escaped})\\s*:\\s*\\{`);
    return !markerPattern.test(typesSource);
  });
  if (missing.length) {
    throw new Error(`Supabase types sanity-check failed. Missing markers: ${missing.join(", ")}`);
  }
}
