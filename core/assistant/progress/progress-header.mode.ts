export type ProgressHeaderMode = "off" | "minimal" | "standard" | "verbose";
export type ProgressHeaderTarget = "chat" | "write" | "both";
export type ProgressHeaderStyle = "emoji" | "plain";

export function normalizeProgressHeaderMode(value: unknown): ProgressHeaderMode {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized === "off" || normalized === "minimal" || normalized === "standard" || normalized === "verbose") {
    return normalized;
  }
  return "standard";
}

export function normalizeProgressHeaderTarget(value: unknown): ProgressHeaderTarget {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized === "chat" || normalized === "write" || normalized === "both") {
    return normalized;
  }
  return "both";
}

export function normalizeProgressHeaderStyle(value: unknown): ProgressHeaderStyle {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized === "emoji" || normalized === "plain") {
    return normalized;
  }
  return "plain";
}

