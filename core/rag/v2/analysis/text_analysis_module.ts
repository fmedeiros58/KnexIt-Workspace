import type { HybridHit } from "@/core/rag/v2/retrieval/hybrid_v2";

export type TextAnalysisPipelineStrategy = "FAST" | "STANDARD" | "DEEP";

export type TextAnalysisStructureNode = {
  level: number;
  title: string;
  page_start: number | null;
  page_end: number | null;
  path: string;
};

export type AnalysisDescriptor = {
  doc_profile: {
    doc_name: string;
    page_total: number;
    language: string;
    has_ocr: boolean;
    headings_confidence: number;
    structure: TextAnalysisStructureNode[];
    key_terms: string[];
    entities: {
      people: string[];
      orgs: string[];
      places: string[];
    };
  };
  task_profile: {
    goal: string;
    output_format: string;
    depth: "short" | "medium" | "long";
    citations_required: boolean;
  };
  complexity: {
    score_0_100: number;
    reasons: string[];
    recommended_pipeline: TextAnalysisPipelineStrategy;
  };
};

type AnalyzeInput = {
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  documentId?: number;
  documentIds?: number[];
  strictDocumentGrounding?: boolean;
  maxResponseTokens: number;
  topK: number;
  preferredResponseLanguageId?: string;
};

const STOP_WORDS_PT = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "o",
  "a",
  "os",
  "as",
  "e",
  "em",
  "para",
  "por",
  "com",
  "sobre",
  "um",
  "uma",
  "que",
  "na",
  "no",
  "nas",
  "nos",
]);

function normalizeText(value: string) {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3 && !STOP_WORDS_PT.has(token));
}

function uniquePush(target: string[], value: string, max = 12) {
  const normalized = `${value || ""}`.trim();
  if (!normalized) return;
  if (target.some((row) => row.toLowerCase() === normalized.toLowerCase())) return;
  target.push(normalized);
  if (target.length > max) {
    target.splice(max);
  }
}

function inferOutputFormat(question: string) {
  const normalized = normalizeText(question).toLowerCase();
  if (/\bresenha\b/.test(normalized)) return "resenha_critica";
  if (/\bresumo|sintese|abstract\b/.test(normalized)) return "resumo";
  if (/\bprojeto de pesquisa|metodologia|cronograma\b/.test(normalized)) return "projeto_pesquisa";
  if (/\brevisao sistematica|prisma\b/.test(normalized)) return "revisao_sistematica";
  if (/\brelatorio tecnico|arquitetura|requisitos\b/.test(normalized)) return "relatorio_tecnico";
  return "academico_generico";
}

function inferDepth(question: string, maxResponseTokens: number): "short" | "medium" | "long" {
  const normalized = normalizeText(question).toLowerCase();
  const words = normalized.split(/\s+/g).filter(Boolean).length;
  if (/\bcurto|breve|uma frase|1 frase\b/.test(normalized)) return "short";
  if (/\bdetalhe|aprofunde|completo|extenso|passo a passo\b/.test(normalized)) return "long";
  if (words >= 24 || maxResponseTokens >= 4096) return "long";
  if (words <= 10 || maxResponseTokens <= 900) return "short";
  return "medium";
}

function inferLanguageTag(input: AnalyzeInput) {
  const preferred = `${input.preferredResponseLanguageId || ""}`.trim();
  if (preferred) return preferred;
  const normalized = normalizeText(input.question);
  if (/\b(the|and|with|from|about|review)\b/i.test(normalized)) return "en";
  return "pt-BR";
}

function resolveComplexity(input: AnalyzeInput, depth: "short" | "medium" | "long") {
  const reasons: string[] = [];
  const normalized = normalizeText(input.question).toLowerCase();
  const wordCount = normalized.split(/\s+/g).filter(Boolean).length;
  let score = 20;

  if (wordCount >= 18) {
    score += 12;
    reasons.push("pergunta_longa");
  }
  if (wordCount >= 28) {
    score += 8;
    reasons.push("alto_escopo_textual");
  }
  if (depth === "long") {
    score += 18;
    reasons.push("profundidade_alta");
  }
  if (depth === "short") {
    score -= 10;
    reasons.push("profundidade_curta");
  }
  if (input.strictDocumentGrounding) {
    score += 16;
    reasons.push("grounding_estrito");
  }
  const docCount = new Set([...(input.documentIds || []), input.documentId].filter((row) => Number.isFinite(Number(row)))).size;
  if (docCount >= 2) {
    score += 10;
    reasons.push("multi_documento");
  }
  if (input.topK >= 20) {
    score += 8;
    reasons.push("topk_alto");
  }
  if (/\bcompare|comparar|critique|analise|avaliacao critica|revisao\b/.test(normalized)) {
    score += 14;
    reasons.push("analise_critica");
  }
  if (/\bcite|citacao|referencia|pagina\b/.test(normalized)) {
    score += 12;
    reasons.push("citacoes_obrigatorias");
  }
  if (input.maxResponseTokens >= 6144) {
    score += 8;
    reasons.push("orcamento_tokens_alto");
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const recommended: TextAnalysisPipelineStrategy = clamped <= 35 ? "FAST" : clamped <= 70 ? "STANDARD" : "DEEP";
  return {
    score_0_100: clamped,
    reasons,
    recommended_pipeline: recommended,
  };
}

function readPageRange(hit: HybridHit) {
  const metadata = (hit.metadata || {}) as Record<string, unknown>;
  const pageStartRaw = metadata.page_start ?? metadata.pageStart ?? metadata.page_number ?? null;
  const pageEndRaw = metadata.page_end ?? metadata.pageEnd ?? pageStartRaw;
  const pageStart = Number.isFinite(Number(pageStartRaw)) ? Math.max(1, Math.trunc(Number(pageStartRaw))) : null;
  const pageEnd = Number.isFinite(Number(pageEndRaw)) ? Math.max(1, Math.trunc(Number(pageEndRaw))) : pageStart;
  return { pageStart, pageEnd };
}

function readSectionPath(hit: HybridHit) {
  const metadata = (hit.metadata || {}) as Record<string, unknown>;
  const raw = metadata.section_path ?? metadata.sectionPath ?? metadata.heading_path ?? "";
  return `${raw || ""}`.trim();
}

function extractEntitiesFromText(text: string, entities: AnalysisDescriptor["doc_profile"]["entities"]) {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) || [];
  for (const match of matches) {
    if (/\b(Universidade|Instituto|Prefeitura|Governo|Ministerio|Faculdade)\b/.test(match)) {
      uniquePush(entities.orgs, match, 8);
      continue;
    }
    if (/\b(Brasil|Rio|Sao Paulo|Lisboa|Porto|Amazonia)\b/.test(match)) {
      uniquePush(entities.places, match, 8);
      continue;
    }
    uniquePush(entities.people, match, 8);
  }
}

export class TextAnalysisModule {
  analyze(input: AnalyzeInput): AnalysisDescriptor {
    const outputFormat = inferOutputFormat(input.question);
    const depth = inferDepth(input.question, input.maxResponseTokens);
    const complexity = resolveComplexity(input, depth);
    const languageTag = inferLanguageTag(input);
    const keyTerms = Array.from(new Set(tokenize(input.question))).slice(0, 16);
    const citationsRequired = /\bcite|citacao|referencia|pagina|abnt|apa\b/.test(normalizeText(input.question).toLowerCase());

    return {
      doc_profile: {
        doc_name: "documento_em_escopo",
        page_total: 0,
        language: languageTag,
        has_ocr: false,
        headings_confidence: 0,
        structure: [],
        key_terms: keyTerms,
        entities: { people: [], orgs: [], places: [] },
      },
      task_profile: {
        goal: normalizeText(input.question).slice(0, 220),
        output_format: outputFormat,
        depth,
        citations_required: citationsRequired,
      },
      complexity,
    };
  }

  enrichWithHits(descriptor: AnalysisDescriptor, hits: HybridHit[]) {
    if (!Array.isArray(hits) || hits.length <= 0) return descriptor;
    const next: AnalysisDescriptor = {
      doc_profile: {
        ...descriptor.doc_profile,
        structure: [...descriptor.doc_profile.structure],
        key_terms: [...descriptor.doc_profile.key_terms],
        entities: {
          people: [...descriptor.doc_profile.entities.people],
          orgs: [...descriptor.doc_profile.entities.orgs],
          places: [...descriptor.doc_profile.entities.places],
        },
      },
      task_profile: {
        ...descriptor.task_profile,
      },
      complexity: {
        ...descriptor.complexity,
        reasons: [...descriptor.complexity.reasons],
      },
    };

    let maxPage = 0;
    let structureHits = 0;
    let ocrHits = 0;
    let docName = next.doc_profile.doc_name;

    for (const hit of hits.slice(0, 64)) {
      if (!docName && hit.title) docName = hit.title;
      if (!docName && hit.sourcePath) docName = hit.sourcePath.split("/").pop() || hit.sourcePath;
      const { pageStart, pageEnd } = readPageRange(hit);
      if (pageStart) maxPage = Math.max(maxPage, pageStart);
      if (pageEnd) maxPage = Math.max(maxPage, pageEnd);
      const sectionPath = readSectionPath(hit);
      if (sectionPath) {
        structureHits += 1;
        const pieces = sectionPath
          .split(">")
          .map((row) => row.trim())
          .filter(Boolean);
        const title = pieces[pieces.length - 1] || sectionPath;
        const path = pieces.join(" > ");
        if (!next.doc_profile.structure.some((row) => row.path.toLowerCase() === path.toLowerCase())) {
          next.doc_profile.structure.push({
            level: Math.max(1, pieces.length),
            title,
            page_start: pageStart,
            page_end: pageEnd,
            path,
          });
        }
      }
      const metadata = (hit.metadata || {}) as Record<string, unknown>;
      const hasOcr = metadata.has_ocr === true || metadata.ocr === true || metadata.ocr_source === true;
      if (hasOcr) ocrHits += 1;
      const content = `${hit.title || ""}\n${hit.text || ""}`;
      for (const token of tokenize(content).slice(0, 24)) {
        uniquePush(next.doc_profile.key_terms, token, 24);
      }
      extractEntitiesFromText(content, next.doc_profile.entities);
    }

    next.doc_profile.doc_name = docName || next.doc_profile.doc_name;
    next.doc_profile.page_total = maxPage;
    next.doc_profile.has_ocr = ocrHits > 0;
    next.doc_profile.headings_confidence = structureHits > 0 ? Math.min(1, structureHits / Math.max(4, hits.length / 3)) : 0;
    next.doc_profile.structure = next.doc_profile.structure
      .sort((a, b) => {
        const byPage = Number(a.page_start || 0) - Number(b.page_start || 0);
        if (byPage !== 0) return byPage;
        return a.path.localeCompare(b.path);
      })
      .slice(0, 64);

    if (next.doc_profile.structure.length > 0 && !next.complexity.reasons.includes("estrutura_documental_detectada")) {
      next.complexity.reasons.push("estrutura_documental_detectada");
    }
    if (maxPage >= 40) {
      next.complexity.score_0_100 = Math.min(100, next.complexity.score_0_100 + 6);
      if (!next.complexity.reasons.includes("documento_extenso")) {
        next.complexity.reasons.push("documento_extenso");
      }
      next.complexity.recommended_pipeline =
        next.complexity.score_0_100 <= 35 ? "FAST" : next.complexity.score_0_100 <= 70 ? "STANDARD" : "DEEP";
    }

    return next;
  }
}
