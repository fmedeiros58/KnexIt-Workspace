import { Pool, type PoolConfig, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

import { loadVectorDatabaseConfig, type VectorDatabaseConfig } from "../config/env";

function toPoolConfig(config: VectorDatabaseConfig): PoolConfig {
  const poolConfig: PoolConfig = {
    connectionString: config.databaseUrl,
    max: 10,
  };
  if (config.ssl) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
  return poolConfig;
}

export class VectorDatabaseClient {
  private readonly pool: Pool;
  readonly config: VectorDatabaseConfig;
  readonly embeddingDimension: number;

  constructor(config: VectorDatabaseConfig = loadVectorDatabaseConfig()) {
    this.config = config;
    this.embeddingDimension = config.embeddingDimension;
    this.pool = new Pool(toPoolConfig(config));
  }

  async connect() {
    const client = await this.pool.connect();
    client.release();
    return `connected to ${this.config.databaseUrl}`;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
    return this.pool.query<T>(text, params);
  }

  async withClient<T>(handler: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      return await handler(client);
    } finally {
      client.release();
    }
  }

  async ensurePgVectorExtension(): Promise<QueryResult<QueryResultRow>> {
    return this.pool.query("create extension if not exists vector");
  }

  async close() {
    await this.pool.end();
  }
}

export function createVectorDatabaseClient(raw = process.env) {
  return new VectorDatabaseClient(loadVectorDatabaseConfig(raw));
}
