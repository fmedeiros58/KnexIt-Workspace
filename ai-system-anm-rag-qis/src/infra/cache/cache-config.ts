export interface CacheConfig {
  redisUrl: string;
  ttlSeconds: number;
}

export const cacheConfig: CacheConfig = {
  redisUrl: process.env.ANM_REDIS_URL || "redis://127.0.0.1:6379",
  ttlSeconds: Number(process.env.ANM_CACHE_TTL_SECONDS || 300),
};
