import { Pool, type PoolConfig } from "pg";

import { sqlConfig } from "./sql-config";

export interface KnexLikeClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

interface InMemoryRow {
  id: string;
  values: unknown[];
  createdAt: string;
}

const inMemoryStore = new Map<string, InMemoryRow[]>();

let activeConnection = sqlConfig.connectionString;
let healthyPool: Pool | null = null;
let poolBootstrap: Promise<Pool> | null = null;
let lastRuntimeError: string | null = null;
let inMemoryFallbackHits = 0;

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function extractTableName(sql: string) {
  const normalized = normalizeSql(sql);
  const insertMatch = normalized.match(/insert into ([a-z0-9_."-]+)/);
  if (insertMatch?.[1]) return insertMatch[1];
  const fromMatch = normalized.match(/from ([a-z0-9_."-]+)/);
  if (fromMatch?.[1]) return fromMatch[1];
  return "generic";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(timeoutLabel)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function toPoolConfig(connectionString: string): PoolConfig {
  const config: PoolConfig = {
    connectionString,
    max: sqlConfig.poolMax,
    min: sqlConfig.poolMin,
    connectionTimeoutMillis: sqlConfig.connectTimeoutMs,
    query_timeout: sqlConfig.queryTimeoutMs,
    statement_timeout: sqlConfig.queryTimeoutMs,
    idleTimeoutMillis: 30000,
  };
  if (sqlConfig.ssl) {
    config.ssl = { rejectUnauthorized: false };
  }
  return config;
}

async function selectHealthyPool() {
  const failures: string[] = [];

  for (const candidate of sqlConfig.connectionCandidates) {
    if (!candidate) continue;
    const pool = new Pool(toPoolConfig(candidate));
    try {
      await withTimeout(
        pool.query("select 1 as one"),
        sqlConfig.healthcheckTimeoutMs,
        `SQL_HEALTHCHECK_TIMEOUT (${sqlConfig.healthcheckTimeoutMs}ms)`,
      );
      activeConnection = candidate;
      lastRuntimeError = null;
      return pool;
    } catch (error) {
      failures.push(`${candidate} => ${error instanceof Error ? error.message : "unknown_error"}`);
      await pool.end().catch(() => null);
    }
  }

  throw new Error(`SQL_ALL_ENDPOINTS_UNREACHABLE | ${failures.join(" | ")}`);
}

async function ensurePool() {
  if (healthyPool) return healthyPool;
  if (!poolBootstrap) {
    poolBootstrap = selectHealthyPool()
      .then((pool) => {
        healthyPool = pool;
        return pool;
      })
      .finally(() => {
        poolBootstrap = null;
      });
  }
  return poolBootstrap;
}

async function queryInMemory(sql: string, params: unknown[] = []) {
  const normalized = normalizeSql(sql);

  if (normalized.startsWith("select")) {
    if (/select 1\b/.test(normalized)) {
      return { rows: [{ one: 1 }] };
    }
    const table = extractTableName(normalized);
    return { rows: [...(inMemoryStore.get(table) || [])] };
  }

  if (normalized.startsWith("insert")) {
    const table = extractTableName(normalized);
    const existing = inMemoryStore.get(table) || [];
    existing.push({
      id: `${table}-${Date.now()}-${existing.length + 1}`,
      values: params,
      createdAt: new Date().toISOString(),
    });
    inMemoryStore.set(table, existing.slice(-500));
    return { rows: [] };
  }

  if (normalized.startsWith("delete")) {
    const table = extractTableName(normalized);
    inMemoryStore.delete(table);
    return { rows: [] };
  }

  return { rows: [] };
}

export function createKnexClient(): KnexLikeClient {
  return {
    async query(sql, params = []) {
      try {
        const pool = await ensurePool();
        const result = await pool.query(sql, params as any[]);
        return { rows: (result.rows || []) as unknown[] };
      } catch (error) {
        lastRuntimeError = error instanceof Error ? error.message : `${error}`;
        if (!sqlConfig.fallbackInMemoryEnabled) throw error;
        inMemoryFallbackHits += 1;
        return queryInMemory(sql, params);
      }
    },
  };
}

export const knexClientInfo = {
  adapter: "postgres-with-failover",
  connection: sqlConfig.connectionString,
  connectionCandidates: sqlConfig.connectionCandidates,
  fallbackInMemoryEnabled: sqlConfig.fallbackInMemoryEnabled,
  sourceKeys: sqlConfig.sourceKeys,
};

export function getKnexClientRuntimeInfo() {
  return {
    adapter: knexClientInfo.adapter,
    configuredConnection: sqlConfig.connectionString,
    activeConnection,
    hasHealthyPool: Boolean(healthyPool),
    fallbackInMemoryEnabled: sqlConfig.fallbackInMemoryEnabled,
    inMemoryFallbackHits,
    lastRuntimeError,
  };
}

export async function closeKnexClientPool() {
  if (!healthyPool) return;
  await healthyPool.end().catch(() => null);
  healthyPool = null;
  poolBootstrap = null;
}
