export interface SqlConfig {
  connectionString: string;
  connectionCandidates: string[];
  poolMin: number;
  poolMax: number;
  ssl: boolean;
  connectTimeoutMs: number;
  queryTimeoutMs: number;
  healthcheckTimeoutMs: number;
  fallbackInMemoryEnabled: boolean;
  blockedLegacyKeys: string[];
  sourceKeys: {
    connection: string;
    fallbacks: string;
    poolMin: string;
    poolMax: string;
    ssl: string;
    connectTimeoutMs: string;
    queryTimeoutMs: string;
    healthcheckTimeoutMs: string;
    fallbackInMemoryEnabled: string;
  };
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeUrl(value: string | undefined) {
  return `${value || ""}`.trim().replace(/\/+$/, "");
}

function parseCsv(value: string | undefined) {
  return `${value || ""}`
    .split(/[,\n;]+/g)
    .map((item) => normalizeUrl(item))
    .filter(Boolean);
}

function unique(items: string[]) {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    output.push(item);
  }
  return output;
}

function firstDefined(entries: Array<{ key: string; value: string | undefined }>, fallback = "") {
  for (const entry of entries) {
    const normalized = `${entry.value || ""}`.trim();
    if (normalized) return { key: entry.key, value: normalized };
  }
  return { key: "default", value: fallback };
}

function resolveBoolean(
  entries: Array<{ key: string; value: string | undefined }>,
  fallback: boolean,
) {
  for (const entry of entries) {
    const normalized = `${entry.value || ""}`.trim();
    if (!normalized) continue;
    return { key: entry.key, value: parseBooleanFlag(normalized, fallback) };
  }
  return { key: "default", value: fallback };
}

function resolveInt(
  entries: Array<{ key: string; value: string | undefined }>,
  fallback: number,
  min: number,
  max: number,
) {
  for (const entry of entries) {
    const normalized = `${entry.value || ""}`.trim();
    if (!normalized) continue;
    return { key: entry.key, value: parsePositiveInt(normalized, fallback, min, max) };
  }
  return { key: "default", value: fallback };
}

const LEGACY_SQL_ENV_KEYS = [
  "ANM_SQL_URL",
  "ANM_RUNTIME_SQL_URL",
  "ANM_IDENTITY_SQL_URL",
  "ANM_SQL_URL_FALLBACKS",
  "ANM_SQL_POOL_MIN",
  "ANM_SQL_POOL_MAX",
  "ANM_SQL_SSL",
  "ANM_SQL_CONNECT_TIMEOUT_MS",
  "ANM_SQL_QUERY_TIMEOUT_MS",
  "ANM_SQL_HEALTHCHECK_TIMEOUT_MS",
  "ANM_SQL_FALLBACK_IN_MEMORY",
] as const;

function resolveBlockedLegacyKeys(env: NodeJS.ProcessEnv) {
  return LEGACY_SQL_ENV_KEYS.filter((key) => `${env[key] || ""}`.trim().length > 0);
}

const blockedLegacyKeys = resolveBlockedLegacyKeys(process.env);
if (blockedLegacyKeys.length) {
  throw new Error(
    `LEGACY_SQL_ENV_BLOCKED: use AI_SYSTEM_ANM_* keys only. Blocked keys: ${blockedLegacyKeys.join(", ")}`,
  );
}
const resolvedConnection = firstDefined(
  [
    { key: "AI_SYSTEM_ANM_SQL_URL", value: process.env.AI_SYSTEM_ANM_SQL_URL },
    { key: "AI_SYSTEM_ANM_RUNTIME_SQL_URL", value: process.env.AI_SYSTEM_ANM_RUNTIME_SQL_URL },
    { key: "AI_SYSTEM_ANM_IDENTITY_SQL_URL", value: process.env.AI_SYSTEM_ANM_IDENTITY_SQL_URL },
    { key: "VECTOR_DATABASE_URL", value: process.env.VECTOR_DATABASE_URL },
    { key: "DATABASE_URL", value: process.env.DATABASE_URL },
  ],
  "",
);

const explicitConnection = normalizeUrl(resolvedConnection.value);

const defaultCandidates = [
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  "postgresql://postgres:postgres@localhost:54322/postgres",
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  "postgresql://postgres:postgres@localhost:5432/postgres",
];

const connectionCandidates = unique([
  explicitConnection,
  ...parseCsv(
    firstDefined(
      [
        { key: "AI_SYSTEM_ANM_SQL_URL_FALLBACKS", value: process.env.AI_SYSTEM_ANM_SQL_URL_FALLBACKS },
      ],
      "",
    ).value,
  ),
  ...parseCsv(process.env.VECTOR_DATABASE_URL_FALLBACKS),
  ...defaultCandidates,
]);

const resolvedPoolMin = resolveInt(
  [
    { key: "AI_SYSTEM_ANM_SQL_POOL_MIN", value: process.env.AI_SYSTEM_ANM_SQL_POOL_MIN },
  ],
  1,
  0,
  30,
);

const resolvedPoolMax = resolveInt(
  [
    { key: "AI_SYSTEM_ANM_SQL_POOL_MAX", value: process.env.AI_SYSTEM_ANM_SQL_POOL_MAX },
  ],
  10,
  1,
  100,
);

const resolvedSsl = resolveBoolean(
  [
    { key: "AI_SYSTEM_ANM_SQL_SSL", value: process.env.AI_SYSTEM_ANM_SQL_SSL },
  ],
  false,
);

const resolvedConnectTimeout = resolveInt(
  [
    { key: "AI_SYSTEM_ANM_SQL_CONNECT_TIMEOUT_MS", value: process.env.AI_SYSTEM_ANM_SQL_CONNECT_TIMEOUT_MS },
  ],
  3000,
  500,
  120000,
);

const resolvedQueryTimeout = resolveInt(
  [
    { key: "AI_SYSTEM_ANM_SQL_QUERY_TIMEOUT_MS", value: process.env.AI_SYSTEM_ANM_SQL_QUERY_TIMEOUT_MS },
  ],
  60000,
  1000,
  300000,
);

const resolvedHealthTimeout = resolveInt(
  [
    { key: "AI_SYSTEM_ANM_SQL_HEALTHCHECK_TIMEOUT_MS", value: process.env.AI_SYSTEM_ANM_SQL_HEALTHCHECK_TIMEOUT_MS },
  ],
  2500,
  500,
  60000,
);

const resolvedFallbackInMemory = resolveBoolean(
  [
    { key: "AI_SYSTEM_ANM_SQL_FALLBACK_IN_MEMORY", value: process.env.AI_SYSTEM_ANM_SQL_FALLBACK_IN_MEMORY },
  ],
  true,
);

export const sqlConfig: SqlConfig = {
  connectionString: connectionCandidates[0] || defaultCandidates[0],
  connectionCandidates,
  poolMin: resolvedPoolMin.value,
  poolMax: resolvedPoolMax.value,
  ssl: resolvedSsl.value,
  connectTimeoutMs: resolvedConnectTimeout.value,
  queryTimeoutMs: resolvedQueryTimeout.value,
  healthcheckTimeoutMs: resolvedHealthTimeout.value,
  fallbackInMemoryEnabled: resolvedFallbackInMemory.value,
  blockedLegacyKeys,
  sourceKeys: {
    connection: resolvedConnection.key,
    fallbacks: firstDefined(
      [
        { key: "AI_SYSTEM_ANM_SQL_URL_FALLBACKS", value: process.env.AI_SYSTEM_ANM_SQL_URL_FALLBACKS },
      ],
      "default",
    ).key,
    poolMin: resolvedPoolMin.key,
    poolMax: resolvedPoolMax.key,
    ssl: resolvedSsl.key,
    connectTimeoutMs: resolvedConnectTimeout.key,
    queryTimeoutMs: resolvedQueryTimeout.key,
    healthcheckTimeoutMs: resolvedHealthTimeout.key,
    fallbackInMemoryEnabled: resolvedFallbackInMemory.key,
  },
};
