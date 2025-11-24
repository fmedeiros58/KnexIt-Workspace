import type { GenericSearchStrategy, SearchResultRecord, SourceId } from "./types";
import pubmedAdapter from "./sources/pubmedAdapter";
import crossrefAdapter from "./sources/crossrefAdapter";
import scieloAdapter from "./sources/scieloAdapter";
import arxivAdapter from "./sources/arxivAdapter";
import doajAdapter from "./sources/doajAdapter";

export interface SourceAdapter {
  id: SourceId;
  displayName: string;
  isEnabled: (env: NodeJS.ProcessEnv) => boolean;
  supports: {
    booleanSearch: boolean;
    dateFilters: boolean;
    languageFilters: boolean;
  };
  buildQuery: (strategy: GenericSearchStrategy) => string | Record<string, any>;
  runQuery: (query: string | Record<string, any>) => Promise<SearchResultRecord[]>;
}

const ALL_ADAPTERS: SourceAdapter[] = [
  pubmedAdapter,
  crossrefAdapter,
  scieloAdapter,
  arxivAdapter,
  doajAdapter,
];

export function getAllSources(): SourceAdapter[] {
  return ALL_ADAPTERS;
}

export function getEnabledSources(env: NodeJS.ProcessEnv): SourceAdapter[] {
  return ALL_ADAPTERS.filter((a) => a.isEnabled(env));
}

