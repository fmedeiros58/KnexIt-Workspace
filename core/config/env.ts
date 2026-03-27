import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  JWT_SECRET: z.string().min(10),
  DATABASE_URL: z
    .union([z.string().url(), z.literal(""), z.undefined()])
    .optional()
    .transform((value) => (value ? value : undefined)),
});

const vectorSchema = z.object({
  DATABASE_URL: z.string().optional(),
  VECTOR_DATABASE_URL: z.string().optional(),
  VECTOR_DATABASE_URL_FALLBACKS: z.string().optional(),
  VECTOR_DB_HOST: z.string().default("127.0.0.1"),
  VECTOR_DB_PORT: z.coerce.number().int().positive().default(5432),
  VECTOR_DB_NAME: z.string().default("postgres"),
  VECTOR_DB_USER: z.string().default("postgres"),
  VECTOR_DB_PASSWORD: z.string().default(""),
  VECTOR_DB_SSL: z.string().optional(),
  VECTOR_DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  VECTOR_DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  VECTOR_DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  VECTOR_DB_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  VECTOR_DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  VECTOR_DB_HEALTHCHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(768),
  VECTOR_DISTANCE_STRATEGY: z.enum(["cosine"]).default("cosine"),
  VECTOR_SEARCH_TOP_K_DEFAULT: z.coerce.number().int().positive().default(8),
  VECTOR_SEARCH_TOP_K_MAX: z.coerce.number().int().positive().default(50),
  VECTOR_SEARCH_MAX_DISTANCE_DEFAULT: z.coerce.number().positive().optional(),
});

const ragIngestionSchema = z.object({
  RAG_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  RAG_CHUNK_SIZE_CHARS: z.coerce.number().int().positive().default(1200),
  RAG_CHUNK_OVERLAP_CHARS: z.coerce.number().int().min(0).default(180),
  RAG_MAX_CHUNKS_PER_DOC: z.coerce.number().int().positive().default(5000),
  RAG_INGEST_EMBED_CHUNKS: z.string().optional(),
  RAG_INGEST_EMBED_REQUIRED: z.string().optional(),
  RAG_INGEST_EMBED_BATCH_SIZE: z.coerce.number().int().positive().default(16),
});

export const DEFAULT_EMBEDDING_DIMENSION = 768;

function normalizeOptional(value: string | undefined | null) {
  const normalized = String(value || "").trim();
  return normalized ? normalized : "";
}

function parseBooleanFlag(value: string | undefined, fallback = false) {
  const normalized = normalizeOptional(value).toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseCsvUrls(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => normalizeOptional(item).replace(/\/+$/, ""))
    .filter(Boolean);
}

function uniqueUrls(urls: string[]) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const rawUrl of urls) {
    const normalized = normalizeOptional(rawUrl).replace(/\/+$/, "");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function deriveLoopbackFallbacks(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname === "127.0.0.1") {
      parsed.hostname = "localhost";
      return [parsed.toString().replace(/\/+$/, "")];
    }
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      return [parsed.toString().replace(/\/+$/, "")];
    }
  } catch {
    // noop
  }
  return [];
}

function buildPostgresUrl({
  host,
  port,
  database,
  user,
  password,
}: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}) {
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
}

export type VectorDatabaseConfig = {
  databaseUrl: string;
  databaseUrlCandidates: string[];
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  poolMax: number;
  connectTimeoutMs: number;
  idleTimeoutMs: number;
  queryTimeoutMs: number;
  statementTimeoutMs: number;
  healthcheckTimeoutMs: number;
  embeddingDimension: number;
  distanceStrategy: "cosine";
  searchTopKDefault: number;
  searchTopKMax: number;
  searchMaxDistanceDefault: number | null;
  source: "VECTOR_DATABASE_URL" | "DATABASE_URL" | "VECTOR_DB_*";
};

export type RagIngestionConfig = {
  maxFileSizeBytes: number;
  chunkSizeChars: number;
  chunkOverlapChars: number;
  maxChunksPerDocument: number;
  embedChunksOnIngest: boolean;
  requireEmbeddingsOnIngest: boolean;
  embeddingBatchSize: number;
};

export function loadEnv(raw = process.env) {
  return schema.parse(raw);
}

export function loadVectorDatabaseConfig(raw = process.env): VectorDatabaseConfig {
  const parsed = vectorSchema.parse(raw);
  const distanceStrategy = parsed.VECTOR_DISTANCE_STRATEGY;

  const explicitVectorUrl = normalizeOptional(parsed.VECTOR_DATABASE_URL);
  const fallbackDatabaseUrl = normalizeOptional(parsed.DATABASE_URL);
  const resolvedDatabaseUrl =
    explicitVectorUrl ||
    fallbackDatabaseUrl ||
    buildPostgresUrl({
      host: parsed.VECTOR_DB_HOST,
      port: parsed.VECTOR_DB_PORT,
      database: parsed.VECTOR_DB_NAME,
      user: parsed.VECTOR_DB_USER,
      password: parsed.VECTOR_DB_PASSWORD,
    });
  const envFallbackUrls = parseCsvUrls(parsed.VECTOR_DATABASE_URL_FALLBACKS);
  const loopbackFallbackUrls = deriveLoopbackFallbacks(resolvedDatabaseUrl);
  const databaseUrlCandidates = uniqueUrls([resolvedDatabaseUrl, ...envFallbackUrls, ...loopbackFallbackUrls]);

  return {
    databaseUrl: resolvedDatabaseUrl,
    databaseUrlCandidates,
    host: parsed.VECTOR_DB_HOST,
    port: parsed.VECTOR_DB_PORT,
    database: parsed.VECTOR_DB_NAME,
    user: parsed.VECTOR_DB_USER,
    password: parsed.VECTOR_DB_PASSWORD,
    ssl: parseBooleanFlag(parsed.VECTOR_DB_SSL, false),
    poolMax: Math.max(1, Math.min(200, parsed.VECTOR_DB_POOL_MAX)),
    connectTimeoutMs: Math.max(500, Math.min(120_000, parsed.VECTOR_DB_CONNECT_TIMEOUT_MS)),
    idleTimeoutMs: Math.max(1_000, Math.min(300_000, parsed.VECTOR_DB_IDLE_TIMEOUT_MS)),
    queryTimeoutMs: Math.max(1_000, Math.min(300_000, parsed.VECTOR_DB_QUERY_TIMEOUT_MS)),
    statementTimeoutMs: Math.max(1_000, Math.min(300_000, parsed.VECTOR_DB_STATEMENT_TIMEOUT_MS)),
    healthcheckTimeoutMs: Math.max(500, Math.min(60_000, parsed.VECTOR_DB_HEALTHCHECK_TIMEOUT_MS)),
    embeddingDimension: parsed.EMBEDDING_DIMENSION || DEFAULT_EMBEDDING_DIMENSION,
    distanceStrategy,
    searchTopKDefault: Math.max(1, parsed.VECTOR_SEARCH_TOP_K_DEFAULT),
    searchTopKMax: Math.max(1, parsed.VECTOR_SEARCH_TOP_K_MAX),
    searchMaxDistanceDefault:
      typeof parsed.VECTOR_SEARCH_MAX_DISTANCE_DEFAULT === "number" &&
      Number.isFinite(parsed.VECTOR_SEARCH_MAX_DISTANCE_DEFAULT)
        ? parsed.VECTOR_SEARCH_MAX_DISTANCE_DEFAULT
        : null,
    source: explicitVectorUrl ? "VECTOR_DATABASE_URL" : fallbackDatabaseUrl ? "DATABASE_URL" : "VECTOR_DB_*",
  };
}

export function loadRagIngestionConfig(raw = process.env): RagIngestionConfig {
  const parsed = ragIngestionSchema.parse(raw);
  const chunkSizeChars = Math.max(128, parsed.RAG_CHUNK_SIZE_CHARS);
  const chunkOverlapChars = Math.min(parsed.RAG_CHUNK_OVERLAP_CHARS, Math.max(0, chunkSizeChars - 1));
  const embedChunksOnIngest = parseBooleanFlag(parsed.RAG_INGEST_EMBED_CHUNKS, true);
  const requireEmbeddingsOnIngest = parseBooleanFlag(parsed.RAG_INGEST_EMBED_REQUIRED, false);
  return {
    maxFileSizeBytes: Math.max(1024, parsed.RAG_MAX_FILE_SIZE_BYTES),
    chunkSizeChars,
    chunkOverlapChars,
    maxChunksPerDocument: Math.max(1, parsed.RAG_MAX_CHUNKS_PER_DOC),
    embedChunksOnIngest,
    requireEmbeddingsOnIngest,
    embeddingBatchSize: Math.max(1, Math.min(256, parsed.RAG_INGEST_EMBED_BATCH_SIZE)),
  };
}
