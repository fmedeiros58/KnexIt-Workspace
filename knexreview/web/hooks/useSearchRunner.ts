"use client";

import { useState, useCallback } from "react";
import type { GenericSearchStrategy, SearchResultRecord, SourceId } from "@/lib/knexreview/types";

type SearchResponse = {
  results: SearchResultRecord[];
  bySource: Record<string, { count: number }>;
};

export function useSearchRunner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (strategy: GenericSearchStrategy, sources: SourceId[]): Promise<SearchResponse> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knexreview/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, sources }),
      });
      if (!res.ok) throw new Error("Falha na busca");
      return (await res.json()) as SearchResponse;
    } catch (e: any) {
      setError(e?.message || "Erro desconhecido");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { run, loading, error };
}

