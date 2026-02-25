import { LRUCache } from "lru-cache";
import type { TranslationPair } from "../lib/types";
import { TRANSLATION_CACHE_TTL_MS } from "../lib/constants";

const translationCache = new LRUCache<string, TranslationPair[]>({
  max: 500,
  ttl: TRANSLATION_CACHE_TTL_MS,
  updateAgeOnGet: true,
});

export function getCachedPageTranslation(key: string): TranslationPair[] | null {
  return translationCache.get(key) ?? null;
}

export function setCachedPageTranslation(key: string, value: TranslationPair[]) {
  translationCache.set(key, value);
}

