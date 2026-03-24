import { Pool, type PoolConfig, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

import { loadVectorDatabaseConfig, type VectorDatabaseConfig } from "../config/env";

function maskConnectionString(raw: string) {
  try {
    const parsed = new URL(raw);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return raw;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(label)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function toPoolConfig(config: VectorDatabaseConfig, databaseUrl: string): PoolConfig {
  const poolConfig: PoolConfig = {
    connectionString: databaseUrl,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    query_timeout: config.queryTimeoutMs,
    statement_timeout: config.statementTimeoutMs,
  };
  if (config.ssl) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
  return poolConfig;
}

export class VectorDatabaseClient {
  private pool: Pool | null = null;
  private poolBootstrap: Promise<Pool> | null = null;
  private activeDatabaseUrl: string;
  readonly config: VectorDatabaseConfig;
  readonly embeddingDimension: number;

  constructor(config: VectorDatabaseConfig = loadVectorDatabaseConfig()) {
    this.config = config;
    this.embeddingDimension = config.embeddingDimension;
    this.activeDatabaseUrl = config.databaseUrl;
  }

  private async selectHealthyPool() {
    const errors: string[] = [];
    for (const databaseUrl of this.config.databaseUrlCandidates) {
      const pool = new Pool(toPoolConfig(this.config, databaseUrl));
      try {
        await withTimeout(
          pool.query("select 1"),
          this.config.healthcheckTimeoutMs,
          `VECTOR_DB_HEALTHCHECK_TIMEOUT (${this.config.healthcheckTimeoutMs}ms)`,
        );
        this.activeDatabaseUrl = databaseUrl;
        return pool;
      } catch (error) {
        errors.push(`${maskConnectionString(databaseUrl)} => ${error instanceof Error ? error.message : "unknown_error"}`);
        await pool.end().catch(() => null);
      }
    }
    throw new Error(`VECTOR_DB_ALL_ENDPOINTS_UNREACHABLE | ${errors.join(" | ")}`);
  }

  private async ensurePool() {
    if (this.pool) return this.pool;
    if (!this.poolBootstrap) {
      this.poolBootstrap = this.selectHealthyPool()
        .then((pool) => {
          this.pool = pool;
          return pool;
        })
        .finally(() => {
          this.poolBootstrap = null;
        });
    }
    return this.poolBootstrap;
  }

  async connect() {
    const pool = await this.ensurePool();
    const client = await pool.connect();
    client.release();
    return `connected to ${this.activeDatabaseUrl}`;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
    const pool = await this.ensurePool();
    return pool.query<T>(text, params);
  }

  async withClient<T>(handler: (client: PoolClient) => Promise<T>) {
    const pool = await this.ensurePool();
    const client = await pool.connect();
    try {
      return await handler(client);
    } finally {
      client.release();
    }
  }

  async ensurePgVectorExtension(): Promise<QueryResult<QueryResultRow>> {
    const pool = await this.ensurePool();
    return pool.query("create extension if not exists vector");
  }

  async close() {
    if (!this.pool) return;
    await this.pool.end();
    this.pool = null;
  }
}

export function createVectorDatabaseClient(raw = process.env) {
  return new VectorDatabaseClient(loadVectorDatabaseConfig(raw));
}
