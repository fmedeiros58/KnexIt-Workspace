import type { GenericSearchStrategy, SearchResultRecord } from "../types";
import type { SourceAdapter } from "../sourceRegistry";

const scieloAdapter: SourceAdapter = {
  id: "scielo",
  displayName: "SciELO",
  isEnabled: () => true, // TODO: verificar necessidade de chave/registro para APIs
  supports: { booleanSearch: true, dateFilters: true, languageFilters: true },
  buildQuery: (strategy: GenericSearchStrategy) => ({
    q: strategy.groups.map((g) => g.terms.map((t) => t.term).join(` ${g.joinWith} `)).join(` ${strategy.betweenGroupsOperator} `),
    lang: strategy.languages?.join(","),
    from: strategy.dateRange?.from,
    to: strategy.dateRange?.to,
  }),
  runQuery: async (query) => {
    // TODO: integrar com API real SciELO quando disponível. Mock:
    return [
      {
        id: "scielo-1",
        title: "SciELO mock",
        abstract: "Mock de resultado SciELO.",
        year: 2022,
        source: "scielo",
        url: "https://scielo.org",
      },
    ] satisfies SearchResultRecord[];
  },
};

export default scieloAdapter;

