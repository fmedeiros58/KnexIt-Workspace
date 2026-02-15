type Level = "info" | "warn" | "error" | "debug";

const DEFAULT_META_MAX = 120;
const DEFAULT_META_KEYS = 8;

function cleanInline(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  if (max <= 3) return value.slice(0, max);
  return `${value.slice(0, max - 3)}...`;
}

function formatError(err: Error, max: number, includeStack: boolean) {
  if (includeStack && err.stack) {
    return truncate(cleanInline(err.stack), max);
  }
  return truncate(cleanInline(`${err.name}: ${err.message}`), max);
}

function formatValue(value: unknown, max: number, includeStack: boolean) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return formatError(value, max, includeStack);
  if (Array.isArray(value)) return `Array(${value.length})`;
  switch (typeof value) {
    case "string":
      return truncate(cleanInline(value), max);
    case "number":
    case "boolean":
    case "bigint":
      return String(value);
    case "object":
      return "Object";
    default:
      return truncate(cleanInline(String(value)), max);
  }
}

function compactMeta(meta: Record<string, unknown>, max: number, maxKeys: number, includeStack: boolean) {
  const entries = Object.entries(meta);
  const limited = entries.slice(0, maxKeys);
  const parts = limited.map(([key, value]) => `${key}=${formatValue(value, max, includeStack)}`);
  if (entries.length > maxKeys) {
    parts.push(`+${entries.length - maxKeys} more`);
  }
  return parts.join(" ");
}

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  const format = (process.env.LOG_FORMAT || "compact").toLowerCase();
  const max = Number.parseInt(process.env.LOG_META_MAX || String(DEFAULT_META_MAX), 10);
  const maxKeys = Number.parseInt(process.env.LOG_META_KEYS || String(DEFAULT_META_KEYS), 10);
  const includeStack = process.env.LOG_STACK === "1";

  if (format === "json") {
    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    console.log(JSON.stringify(payload));
    return;
  }

  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const safeMessage = cleanInline(message);
  const metaPart = meta ? ` ${compactMeta(meta, max, maxKeys, includeStack)}` : "";
  console.log(`${ts} ${level.toUpperCase()} ${safeMessage}${metaPart}`);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
};
