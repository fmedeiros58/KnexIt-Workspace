import type { GenericSearchStrategy, SearchResultRecord } from "../types";
import type { SourceAdapter } from "../sourceRegistry";

const arxivAdapter: SourceAdapter = {
  id: "arxiv",
  displayName: "arXiv",
  isEnabled: () => true,
  supports: { booleanSearch: true, dateFilters: false, languageFilters: false },
  buildQuery: (strategy: GenericSearchStrategy) => {
    // arXiv usa sintaxe parecida com Lucene; aqui simplificamos para mock.
    const terms = strategy.groups.map((g) => g.terms.map((t) => t.term).join(` ${g.joinWith} `)).join(` ${strategy.betweenGroupsOperator} `);
    return { search_query: terms };
  },
  runQuery: async (query) => {
    // TODO: integrar com arXiv API real. Mock:
    return [
      {
        id: "arxiv-1",
        title: "arXiv mock paper",
        abstract: "Mock de artigo arXiv.",
        year: 2021,
        source: "arxiv",
        url: "https://arxiv.org/abs/0000.0000",
        pdfUrl: "https://arxiv.org/pdf/0000.0000.pdf",
      },
    ] satisfies SearchResultRecord[];
  },
};

export default arxivAdapter;

