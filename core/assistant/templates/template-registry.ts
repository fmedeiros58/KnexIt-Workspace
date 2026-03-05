import { AcademicGenre } from "@/core/assistant/genre/academic-genre.types";
import type { TemplateRules, TemplateSectionSpec, TemplateSpec } from "@/core/assistant/templates/template-spec";

function section(
  title: string,
  required: boolean,
  options?: Partial<Pick<TemplateSectionSpec, "maxParagraphs" | "maxChars" | "allowBullets">>,
): TemplateSectionSpec {
  return {
    title,
    required,
    maxParagraphs: options?.maxParagraphs ?? 3,
    maxChars: options?.maxChars ?? 2200,
    allowBullets: options?.allowBullets ?? false,
  };
}

const BASE_RULES: TemplateRules = {
  noInvention: true,
  dedupeAcrossSections: true,
  redundancyThreshold: 1,
  minCoverage: 0.72,
  minHeadingsCount: 3,
};

const PT_TEMPLATES: Record<AcademicGenre, TemplateSpec> = {
  [AcademicGenre.RESEARCH_PROJECT]: {
    id: "research_project_pt",
    genre: AcademicGenre.RESEARCH_PROJECT,
    langTag: "pt-BR",
    title: "Projeto de Pesquisa",
    sections: [
      section("Titulo", true, { maxParagraphs: 1, maxChars: 180 }),
      section("Tema e Delimitacao", true),
      section("Problema de Pesquisa", true),
      section("Justificativa", true),
      section("Objetivo Geral", true, { maxParagraphs: 1 }),
      section("Objetivos Especificos", true, { allowBullets: true }),
      section("Hipoteses / Pressupostos", false, { allowBullets: true }),
      section("Referencial Teorico", true, { maxParagraphs: 4, maxChars: 3000 }),
      section("Metodologia", true, { maxParagraphs: 4, maxChars: 3200 }),
      section("Cronograma", true, { allowBullets: true }),
      section("Resultados Esperados", true),
      section("Referencias", false, { allowBullets: true, maxChars: 2600 }),
    ],
    rules: {
      ...BASE_RULES,
      minCoverage: 0.75,
      minHeadingsCount: 6,
    },
    aliases: {
      "titulo do projeto": "Titulo",
      tema: "Tema e Delimitacao",
      delimitacao: "Tema e Delimitacao",
      problema: "Problema de Pesquisa",
      objetivo: "Objetivo Geral",
      "objetivos especificos": "Objetivos Especificos",
      hipotese: "Hipoteses / Pressupostos",
      pressupostos: "Hipoteses / Pressupostos",
      referencial: "Referencial Teorico",
      metodo: "Metodologia",
      cronograma: "Cronograma",
      resultados: "Resultados Esperados",
      bibliografia: "Referencias",
    },
  },
  [AcademicGenre.ABSTRACT_SUMMARY]: {
    id: "abstract_summary_pt",
    genre: AcademicGenre.ABSTRACT_SUMMARY,
    langTag: "pt-BR",
    title: "Resumo Academico",
    sections: [
      section("Tema e Problema", true),
      section("Objetivo", true, { maxParagraphs: 1 }),
      section("Metodologia (se informada)", false, { maxParagraphs: 2 }),
      section("Principais achados/argumentos", true, { maxParagraphs: 3 }),
      section("Conclusao", true, { maxParagraphs: 2 }),
      section("Palavras-chave", true, { maxParagraphs: 1, allowBullets: true, maxChars: 300 }),
    ],
    rules: {
      ...BASE_RULES,
      minCoverage: 0.8,
      minHeadingsCount: 4,
    },
    aliases: {
      tema: "Tema e Problema",
      problema: "Tema e Problema",
      objetivo: "Objetivo",
      metodo: "Metodologia (se informada)",
      metodologia: "Metodologia (se informada)",
      achados: "Principais achados/argumentos",
      argumentos: "Principais achados/argumentos",
      conclusao: "Conclusao",
      "palavras chave": "Palavras-chave",
    },
  },
  [AcademicGenre.CRITICAL_REVIEW]: {
    id: "critical_review_pt",
    genre: AcademicGenre.CRITICAL_REVIEW,
    langTag: "pt-BR",
    title: "Resenha Critica",
    sections: [
      section("Identificacao da obra", true, { maxParagraphs: 2 }),
      section("Sintese do conteudo", true, { maxParagraphs: 3 }),
      section("Tese/argumento central do autor", true, { maxParagraphs: 2 }),
      section("Analise critica", true, { maxParagraphs: 4, maxChars: 3200 }),
      section("Contribuicoes e limitacoes", true, { maxParagraphs: 3 }),
      section("Dialogo com outras obras", false, { maxParagraphs: 3 }),
      section("Conclusao avaliativa", true, { maxParagraphs: 2 }),
      section("Referencias", false, { allowBullets: true, maxChars: 2200 }),
    ],
    rules: {
      ...BASE_RULES,
      minCoverage: 0.78,
      minHeadingsCount: 5,
    },
    aliases: {
      identificacao: "Identificacao da obra",
      obra: "Identificacao da obra",
      sintese: "Sintese do conteudo",
      "argumento central": "Tese/argumento central do autor",
      tese: "Tese/argumento central do autor",
      critica: "Analise critica",
      analise: "Analise critica",
      contribuicoes: "Contribuicoes e limitacoes",
      limitacoes: "Contribuicoes e limitacoes",
      dialogo: "Dialogo com outras obras",
      conclusao: "Conclusao avaliativa",
      bibliografia: "Referencias",
    },
  },
  [AcademicGenre.THESIS_DISSERTATION_SUMMARY]: {
    id: "thesis_diss_summary_pt",
    genre: AcademicGenre.THESIS_DISSERTATION_SUMMARY,
    langTag: "pt-BR",
    title: "Resumo Estruturado de Tese/Dissertacao",
    sections: [
      section("Tema e Problema", true),
      section("Objetivo", true, { maxParagraphs: 1 }),
      section("Referencial / Eixos teoricos", true, { maxParagraphs: 3 }),
      section("Metodologia (se informada)", false, { maxParagraphs: 3 }),
      section("Estrutura (capitulos)", false, { maxParagraphs: 2, allowBullets: true }),
      section("Principais resultados/argumentos", true, { maxParagraphs: 4, maxChars: 3200 }),
      section("Conclusoes", true, { maxParagraphs: 2 }),
      section("Contribuicoes/Implicacoes", true, { maxParagraphs: 2 }),
      section("Limitacoes", false, { maxParagraphs: 2 }),
      section("Palavras-chave", true, { maxParagraphs: 1, allowBullets: true, maxChars: 300 }),
    ],
    rules: {
      ...BASE_RULES,
      minCoverage: 0.75,
      minHeadingsCount: 5,
    },
    aliases: {
      "tema e problema": "Tema e Problema",
      objetivo: "Objetivo",
      referencial: "Referencial / Eixos teoricos",
      eixos: "Referencial / Eixos teoricos",
      metodologia: "Metodologia (se informada)",
      metodo: "Metodologia (se informada)",
      capitulos: "Estrutura (capitulos)",
      estrutura: "Estrutura (capitulos)",
      resultados: "Principais resultados/argumentos",
      argumentos: "Principais resultados/argumentos",
      conclusao: "Conclusoes",
      contribuicoes: "Contribuicoes/Implicacoes",
      implicacoes: "Contribuicoes/Implicacoes",
      limitacoes: "Limitacoes",
      "palavras chave": "Palavras-chave",
    },
  },
  [AcademicGenre.ARTICLE_SUMMARY]: {
    id: "article_summary_pt",
    genre: AcademicGenre.ARTICLE_SUMMARY,
    langTag: "pt-BR",
    title: "Resumo Estruturado de Artigo",
    sections: [
      section("Contexto e problema", true),
      section("Objetivo", true, { maxParagraphs: 1 }),
      section("Metodo (se informado)", false, { maxParagraphs: 2 }),
      section("Resultados", true, { maxParagraphs: 3 }),
      section("Discussao", true, { maxParagraphs: 3 }),
      section("Conclusao", true, { maxParagraphs: 2 }),
      section("Palavras-chave", true, { maxParagraphs: 1, allowBullets: true, maxChars: 300 }),
    ],
    rules: {
      ...BASE_RULES,
      minCoverage: 0.78,
      minHeadingsCount: 4,
    },
    aliases: {
      contexto: "Contexto e problema",
      problema: "Contexto e problema",
      objetivo: "Objetivo",
      metodo: "Metodo (se informado)",
      metodologia: "Metodo (se informado)",
      resultados: "Resultados",
      discussao: "Discussao",
      conclusao: "Conclusao",
      "palavras chave": "Palavras-chave",
    },
  },
  [AcademicGenre.SYSTEMATIC_REVIEW]: {
    id: "systematic_review_pt",
    genre: AcademicGenre.SYSTEMATIC_REVIEW,
    langTag: "pt-BR",
    title: "Revisao Sistematica (PRISMA-like)",
    sections: [
      section("Pergunta de pesquisa", true, { maxParagraphs: 1 }),
      section("Protocolos/Guidelines", false, { maxParagraphs: 2 }),
      section("Bases e estrategia de busca", true, { maxParagraphs: 3, allowBullets: true }),
      section("Criterios de inclusao/exclusao", true, { maxParagraphs: 3, allowBullets: true }),
      section("Processo de selecao", true, { maxParagraphs: 2 }),
      section("Extracao e sintese", true, { maxParagraphs: 3 }),
      section("Resultados principais", true, { maxParagraphs: 4 }),
      section("Limitacoes", true, { maxParagraphs: 2 }),
      section("Conclusoes e implicacoes", true, { maxParagraphs: 2 }),
    ],
    rules: {
      ...BASE_RULES,
      minCoverage: 0.82,
      minHeadingsCount: 6,
    },
    aliases: {
      pergunta: "Pergunta de pesquisa",
      protocolo: "Protocolos/Guidelines",
      prisma: "Protocolos/Guidelines",
      bases: "Bases e estrategia de busca",
      busca: "Bases e estrategia de busca",
      criterios: "Criterios de inclusao/exclusao",
      inclusao: "Criterios de inclusao/exclusao",
      exclusao: "Criterios de inclusao/exclusao",
      selecao: "Processo de selecao",
      extracao: "Extracao e sintese",
      sintese: "Extracao e sintese",
      resultados: "Resultados principais",
      limitacoes: "Limitacoes",
      conclusoes: "Conclusoes e implicacoes",
      implicacoes: "Conclusoes e implicacoes",
    },
  },
  [AcademicGenre.TECHNICAL_REPORT]: {
    id: "technical_report_pt",
    genre: AcademicGenre.TECHNICAL_REPORT,
    langTag: "pt-BR",
    title: "Relatorio Tecnico",
    sections: [
      section("Contexto e escopo", true),
      section("Objetivos", true, { maxParagraphs: 1 }),
      section("Requisitos e restricoes", true, { maxParagraphs: 3, allowBullets: true }),
      section("Solucao proposta", true, { maxParagraphs: 3 }),
      section("Arquitetura/Componentes", true, { maxParagraphs: 3 }),
      section("Implementacao/Plano de execucao", true, { maxParagraphs: 4 }),
      section("Riscos e mitigacao", true, { maxParagraphs: 2, allowBullets: true }),
      section("Metricas de sucesso", true, { maxParagraphs: 2, allowBullets: true }),
      section("Proximos passos", true, { maxParagraphs: 2 }),
    ],
    rules: {
      ...BASE_RULES,
      minCoverage: 0.82,
      minHeadingsCount: 6,
    },
    aliases: {
      contexto: "Contexto e escopo",
      escopo: "Contexto e escopo",
      objetivos: "Objetivos",
      requisitos: "Requisitos e restricoes",
      restricoes: "Requisitos e restricoes",
      solucao: "Solucao proposta",
      arquitetura: "Arquitetura/Componentes",
      componentes: "Arquitetura/Componentes",
      implementacao: "Implementacao/Plano de execucao",
      execucao: "Implementacao/Plano de execucao",
      riscos: "Riscos e mitigacao",
      mitigacao: "Riscos e mitigacao",
      metricas: "Metricas de sucesso",
      "proximos passos": "Proximos passos",
    },
  },
  [AcademicGenre.GENERIC_ACADEMIC]: {
    id: "generic_academic_pt",
    genre: AcademicGenre.GENERIC_ACADEMIC,
    langTag: "pt-BR",
    title: "Texto Academico Estruturado",
    sections: [
      section("Contexto", true),
      section("Objetivo", true, { maxParagraphs: 1 }),
      section("Desenvolvimento", true, { maxParagraphs: 4, maxChars: 3400 }),
      section("Conclusao", true, { maxParagraphs: 2 }),
      section("Referencias (opcional)", false, { allowBullets: true, maxChars: 2200 }),
    ],
    rules: {
      ...BASE_RULES,
      minCoverage: 0.75,
      minHeadingsCount: 3,
    },
    aliases: {
      introducao: "Contexto",
      contexto: "Contexto",
      objetivo: "Objetivo",
      desenvolvimento: "Desenvolvimento",
      analise: "Desenvolvimento",
      conclusao: "Conclusao",
      referencias: "Referencias (opcional)",
    },
  },
};

function cloneTemplate(spec: TemplateSpec, langTag: string): TemplateSpec {
  return {
    ...spec,
    langTag,
    sections: spec.sections.map((row) => ({ ...row })),
    rules: { ...spec.rules },
    aliases: { ...spec.aliases },
  };
}

function normalizeLangTag(value: string | undefined) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return "pt-BR";
  if (normalized.startsWith("pt")) return "pt-BR";
  if (normalized.startsWith("en")) return "en";
  return normalized;
}

export class TemplateRegistry {
  getTemplate(genre: AcademicGenre, langTag = process.env.ACADEMIC_DEFAULT_LANG || "pt-BR"): TemplateSpec {
    const normalizedLangTag = normalizeLangTag(langTag);
    const baseSpec = PT_TEMPLATES[genre] || PT_TEMPLATES[AcademicGenre.GENERIC_ACADEMIC];
    return cloneTemplate(baseSpec, normalizedLangTag);
  }
}
