import { cacheConfig } from "./cache-config";

export interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
}

export function createRedisClient(): RedisClient {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) || null;
    },
    async set(key: string, value: string) {
      store.set(key, value);
    },
  };
}

export const redisClientInfo = {
  url: cacheConfig.redisUrl,
};
