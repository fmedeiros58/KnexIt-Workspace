import { AcademicGenre, type GenreDetectionResult } from "@/core/assistant/genre/academic-genre.types";

type GenreRule = {
  genre: AcademicGenre;
  terms: string[];
};

const EXPLICIT_PATTERNS: Array<{ genre: AcademicGenre; regex: RegExp }> = [
  {
    genre: AcademicGenre.RESEARCH_PROJECT,
    regex: /\b(projeto de pesquisa|plano de pesquisa)\b/,
  },
  {
    genre: AcademicGenre.CRITICAL_REVIEW,
    regex: /\b(resenha critica|resenhar criticamente)\b/,
  },
  {
    genre: AcademicGenre.SYSTEMATIC_REVIEW,
    regex: /\b(revisao sistematica|revisão sistemática)\b/,
  },
  {
    genre: AcademicGenre.TECHNICAL_REPORT,
    regex: /\b(relatorio tecnico|relatório técnico)\b/,
  },
];

const HEURISTIC_RULES: GenreRule[] = [
  {
    genre: AcademicGenre.RESEARCH_PROJECT,
    terms: [
      "projeto",
      "metodologia",
      "cronograma",
      "objetivo geral",
      "objetivos especificos",
      "problema de pesquisa",
    ],
  },
  {
    genre: AcademicGenre.CRITICAL_REVIEW,
    terms: [
      "resenha critica",
      "resenha",
      "avaliacao critica",
      "avaliacao crítica",
      "argumente a favor",
      "argumente contra",
      "analise critica",
    ],
  },
  {
    genre: AcademicGenre.ABSTRACT_SUMMARY,
    terms: ["resumo", "resuma", "sintese", "síntese", "abstract", "sumarize", "summarize"],
  },
  {
    genre: AcademicGenre.THESIS_DISSERTATION_SUMMARY,
    terms: ["dissertacao", "dissertação", "tese", "referencial teorico", "capitulos", "capítulos"],
  },
  {
    genre: AcademicGenre.ARTICLE_SUMMARY,
    terms: ["artigo", "paper", "journal", "metodo", "método", "discussao", "discussão"],
  },
  {
    genre: AcademicGenre.SYSTEMATIC_REVIEW,
    terms: [
      "prisma",
      "bases de dados",
      "string de busca",
      "criterios de inclusao",
      "critérios de inclusão",
      "criterios de exclusao",
      "critérios de exclusão",
      "revisao sistematica",
      "revisão sistemática",
    ],
  },
  {
    genre: AcademicGenre.TECHNICAL_REPORT,
    terms: [
      "relatorio tecnico",
      "relatório técnico",
      "escopo",
      "requisitos",
      "arquitetura",
      "implementacao",
      "implementação",
      "riscos",
      "mitigacao",
      "mitigação",
    ],
  },
];

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function confidenceFromHits(hitCount: number, totalTerms: number) {
  if (hitCount <= 0) return 0;
  const ratio = hitCount / Math.max(1, totalTerms);
  return Math.min(0.94, 0.46 + ratio * 0.58);
}

export class GenreDetectorService {
  detect(input: {
    message: string;
    conversation?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    intentType?: string;
  }): GenreDetectionResult {
    const message = normalize(input.message);
    const conversationTail = (input.conversation || [])
      .slice(-4)
      .map((row) => normalize(row.content))
      .filter(Boolean)
      .join(" ");
    const mergedText = `${message} ${conversationTail}`.trim();

    for (const explicit of EXPLICIT_PATTERNS) {
      if (!explicit.regex.test(mergedText)) continue;
      const matched = mergedText.match(explicit.regex)?.[0] || "";
      return {
        genre: explicit.genre,
        confidence: 0.96,
        source: "explicit",
        matchedTerms: matched ? [matched] : [],
      };
    }

    let bestGenre = AcademicGenre.GENERIC_ACADEMIC;
    let bestConfidence = 0.32;
    let matchedTerms: string[] = [];
    for (const rule of HEURISTIC_RULES) {
      const hits = rule.terms.filter((term) => mergedText.includes(normalize(term)));
      if (!hits.length) continue;
      const confidence = confidenceFromHits(hits.length, rule.terms.length);
      if (confidence <= bestConfidence) continue;
      bestGenre = rule.genre;
      bestConfidence = confidence;
      matchedTerms = hits;
    }

    if (bestGenre === AcademicGenre.GENERIC_ACADEMIC) {
      const intent = normalize(input.intentType || "");
      if (intent === "summary") {
        return {
          genre: AcademicGenre.ABSTRACT_SUMMARY,
          confidence: 0.58,
          source: "heuristic",
          matchedTerms: ["intent:summary"],
        };
      }
      if (intent === "analysis") {
        return {
          genre: AcademicGenre.CRITICAL_REVIEW,
          confidence: 0.56,
          source: "heuristic",
          matchedTerms: ["intent:analysis"],
        };
      }
      return {
        genre: AcademicGenre.GENERIC_ACADEMIC,
        confidence: 0.42,
        source: "fallback",
        matchedTerms: [],
      };
    }

    return {
      genre: bestGenre,
      confidence: bestConfidence,
      source: "heuristic",
      matchedTerms,
    };
  }
}
