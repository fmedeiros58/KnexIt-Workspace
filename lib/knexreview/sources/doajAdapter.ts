import type { GenericSearchStrategy, SearchResultRecord } from "../types";
import type { SourceAdapter } from "../sourceRegistry";

const doajAdapter: SourceAdapter = {
  id: "doaj",
  displayName: "DOAJ",
  isEnabled: () => true, // TODO: verificar se precisa de token; DOAJ tem API aberta limitada
  supports: { booleanSearch: true, dateFilters: true, languageFilters: true },
  buildQuery: (strategy: GenericSearchStrategy) => {
    const q = strategy.groups.map((g) => g.terms.map((t) => t.term).join(` ${g.joinWith} `)).join(` ${strategy.betweenGroupsOperator} `);
    return { q, from: strategy.dateRange?.from, to: strategy.dateRange?.to };
  },
  runQuery: async (query) => {
    // TODO: integrar com DOAJ API real. Mock:
    return [
      {
        id: "doaj-1",
        title: "DOAJ mock article",
        abstract: "Mock de resultado DOAJ.",
        year: 2020,
        source: "doaj",
        url: "https://doaj.org",
      },
    ] satisfies SearchResultRecord[];
  },
};

export default doajAdapter;

