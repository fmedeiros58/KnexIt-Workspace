import { useEffect, useMemo, useRef, useState } from "react";
import type { PageMapping, TranslationPair } from "../lib/types";
import { makeCacheKey } from "../lib/utils";
import { useReaderStore } from "../store/reader.store";

type UseTranslationArgs = {
  documentHash: string | null;
  pageMapping: PageMapping | null;
  sourceLanguage: string;
  targetLanguage: string;
};

export function useTranslation(args: UseTranslationArgs) {
  const setCachedTranslation = useReaderStore((state) => state.setCachedTranslation);
  const translationCache = useReaderStore((state) => state.translationCache);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const cacheKey = useMemo(() => {
    if (!args.documentHash || !args.pageMapping) return null;
    return makeCacheKey([args.documentHash, args.pageMapping.page.number, args.targetLanguage]);
  }, [args.documentHash, args.pageMapping, args.targetLanguage]);

  const cachedPairs = cacheKey ? translationCache[cacheKey] ?? null : null;

  useEffect(() => {
    if (!args.pageMapping || !args.documentHash || !cacheKey) return;
    if (!args.pageMapping.blocks.length) return;
    if (cachedPairs) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    const blocks = args.pageMapping.blocks.map((block) => ({ id: block.id, text: block.text }));

    fetch("/api/vioread/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentHash: args.documentHash,
        pageNumber: args.pageMapping.page.number,
        sourceLanguage: args.sourceLanguage,
        targetLanguage: args.targetLanguage,
        blocks,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Falha ao traduzir página.");
        }
        return response.json() as Promise<{ pairs: TranslationPair[] }>;
      })
      .then((payload) => {
        if (requestIdRef.current !== requestId) return;
        setCachedTranslation(cacheKey, payload.pairs || []);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : "Falha ao traduzir página.");
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setLoading(false);
      });
  }, [
    args.documentHash,
    args.pageMapping,
    args.sourceLanguage,
    args.targetLanguage,
    cacheKey,
    cachedPairs,
    setCachedTranslation,
  ]);

  return {
    pairs: cachedPairs ?? [],
    loading,
    error,
    cacheKey,
    cached: Boolean(cachedPairs),
  };
}

