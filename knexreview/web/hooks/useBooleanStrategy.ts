"use client";

import { useMemo } from "react";
import type { GenericSearchStrategy, BooleanTermGroup, BooleanOperator, SourceId } from "@/lib/knexreview/types";
import { getAllSources } from "@/lib/knexreview/sourceRegistry";

export function useBooleanStrategy(strategy: GenericSearchStrategy) {
  const addGroup = (groups: BooleanTermGroup[], group: BooleanTermGroup) => [...groups, group];
  const updateBetweenOperator = (op: BooleanOperator) => op;

  const asStringsBySource = useMemo(() => {
    const adapters = getAllSources();
    return adapters.reduce<Record<SourceId, string | Record<string, any>>>((acc, adapter) => {
      acc[adapter.id] = adapter.buildQuery(strategy);
      return acc;
    }, {} as Record<SourceId, string | Record<string, any>>);
  }, [strategy]);

  return { addGroup, updateBetweenOperator, asStringsBySource };
}

