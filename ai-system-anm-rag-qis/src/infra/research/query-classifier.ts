import type { ResearchIntent } from "./research-types";

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export interface ClassifiedQuery {
  normalizedQuery: string;
  intent: ResearchIntent;
  needsFreshness: boolean;
  prefersScientificSources: boolean;
  prefersBiomedicalSources: boolean;
  prefersBibliographicSources: boolean;
  isChitChatLikely: boolean;
}

export function classifyResearchQuery(query: string): ClassifiedQuery {
  const normalizedQuery = normalize(query);

  const needsFreshness =
    /\b(hoje|agora|atual|atualmente|recente|recentes|ultimas|ultimos|latest|current|today|recent|news)\b/.test(
      normalizedQuery,
    );

  const biomedical =
    /\b(ensaio clinico|trial|pubmed|medline|doenca|biomedic|biomedical|cancer|neuro|cortisol|hpa|autonomic|vagal|stress|estresse|saude)\b/.test(
      normalizedQuery,
    );

  const bibliographic =
    /\b(doi|issn|isbn|artigo|paper|papers|referencia|citacao|autor|autores|journal|revista|crossref|openalex|arxiv)\b/.test(
      normalizedQuery,
    );

  const scientific =
    biomedical ||
    bibliographic ||
    /\b(estudo|evidencia|metanalise|meta-analise|systematic review|revisao sistematica|academic|scientific|cientifico)\b/.test(
      normalizedQuery,
    );

  const isChitChatLikely =
    normalizedQuery.length <= 42 &&
    /\b(oi|ola|opa|bom dia|boa tarde|boa noite|tudo bem|como vai|blz|beleza|e ai|hello|hi|hey)\b/.test(
      normalizedQuery,
    );

  let intent: ResearchIntent = "general";
  if (biomedical) intent = "biomedical";
  else if (bibliographic) intent = "bibliographic";
  else if (scientific) intent = "scientific";
  else if (needsFreshness) intent = "current_events";
  else if (
    /\b(base local|db local|somente local|apenas local|no meu banco|na minha base|no rag|vetorial)\b/.test(
      normalizedQuery,
    )
  ) {
    intent = "local_only";
  } else if (/\b(fato|dados|factual|verificar|confirmar)\b/.test(normalizedQuery)) {
    intent = "factual";
  }

  return {
    normalizedQuery,
    intent,
    needsFreshness,
    prefersScientificSources: scientific,
    prefersBiomedicalSources: biomedical,
    prefersBibliographicSources: bibliographic,
    isChitChatLikely,
  };
}
