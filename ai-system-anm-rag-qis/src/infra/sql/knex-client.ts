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

export function createKnexClient(): KnexLikeClient {
  return {
    async query(sql, params = []) {
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
    },
  };
}

export const knexClientInfo = {
  adapter: "in-memory-sql-emulator",
  connection: sqlConfig.connectionString,
};
