import type { PipelineProgressStage, ProgressCounters, ProgressTarget } from "@/core/rag/v2/progress/types";

type ProgressMessageInput = {
  requestId: string;
  stage: PipelineProgressStage;
  substage?: string;
  langTag?: string;
  target?: ProgressTarget;
  counters?: ProgressCounters;
  userGoalShort?: string;
};

const STAGE_TEMPLATES_PT: Record<PipelineProgressStage, string[]> = {
  INGEST: ["Recebendo sua solicitacao.", "Preparando a execucao do pedido."],
  OCR: ["OCR em andamento para {doc_name}.", "Lendo texto por OCR em {doc_name}."],
  PARSE: ["Extraindo texto de {doc_name}.", "Fazendo parsing do documento {doc_name}."],
  STRUCTURE: ["Mapeando secoes e headings de {doc_name}.", "Detectando estrutura textual em {doc_name}."],
  CHUNK: ["Segmentando conteudo em chunks de contexto.", "Criando chunks com preservacao de contexto."],
  EMBED: ["Indexando semanticamente os chunks.", "Gerando embeddings para busca vetorial."],
  RETRIEVE: ["Buscando trechos relevantes para: \"{goal}\".", "Recuperando evidencias pertinentes ao pedido."],
  RERANK: ["Refinando relevancia com reranking.", "Priorizando os trechos com melhor aderencia."],
  PACK: ["Organizando contexto e removendo redundancia.", "Empacotando evidencias para composicao final."],
  DRAFT: ["Redigindo resposta com base nas evidencias.", "Escrevendo o texto com foco no pedido."],
  CITE_AUDIT: ["Checando sustentacao das afirmacoes e citacoes.", "Auditando referencias por pagina/chunk."],
  MERGE: ["Consolidando secoes e revisando coerencia.", "Unificando blocos e melhorando fluidez textual."],
  FINALIZE: ["Finalizando resposta.", "Concluindo formatacao final da resposta."],
};

const STAGE_TEMPLATES_EN: Record<PipelineProgressStage, string[]> = {
  INGEST: ["Receiving your request.", "Preparing execution pipeline."],
  OCR: ["Running OCR for {doc_name}.", "Extracting OCR text from {doc_name}."],
  PARSE: ["Parsing {doc_name}.", "Extracting text from {doc_name}."],
  STRUCTURE: ["Mapping headings and sections in {doc_name}.", "Detecting document structure in {doc_name}."],
  CHUNK: ["Segmenting content into chunks.", "Creating context-preserving chunks."],
  EMBED: ["Indexing chunks semantically.", "Generating embeddings for retrieval."],
  RETRIEVE: ["Retrieving relevant evidence for \"{goal}\".", "Searching relevant passages."],
  RERANK: ["Reranking evidence by relevance.", "Refining candidate ordering."],
  PACK: ["Packing context and removing redundancy.", "Organizing selected evidence for drafting."],
  DRAFT: ["Drafting response from evidence.", "Writing response with grounded context."],
  CITE_AUDIT: ["Auditing claims and citations.", "Checking claim-to-evidence alignment."],
  MERGE: ["Merging sections and improving coherence.", "Consolidating sections into final flow."],
  FINALIZE: ["Finalizing response.", "Completing final response formatting."],
};

function normalizeTag(value: string | undefined) {
  const raw = `${value || ""}`.trim().toLowerCase();
  if (!raw) return "pt-br";
  return raw;
}

function resolveLanguageTag(langTag?: string) {
  const normalized = normalizeTag(langTag);
  if (normalized.startsWith("en")) return "en";
  return "pt-BR";
}

function stablePick(choices: string[], seed: string) {
  if (!choices.length) return "";
  let hash = 5381;
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(idx);
  }
  const index = Math.abs(hash) % choices.length;
  return choices[index] || choices[0] || "";
}

function normalizeName(value: unknown) {
  const normalized = `${value || ""}`.trim();
  return normalized || "documento";
}

function normalizeGoal(value: string | undefined) {
  const normalized = `${value || ""}`.replace(/\s+/g, " ").trim();
  if (!normalized) return "pedido atual";
  if (normalized.length <= 72) return normalized;
  return `${normalized.slice(0, 69).trimEnd()}...`;
}

function interpolate(
  template: string,
  input: {
    docName: string;
    goal: string;
  },
) {
  return template.replaceAll("{doc_name}", input.docName).replaceAll("{goal}", input.goal);
}

function buildCounterSuffix(counters: ProgressCounters | undefined, target: ProgressTarget | undefined, lang: "pt-BR" | "en") {
  const parts: string[] = [];
  const pageCurrent = Number(target?.page?.current);
  const pageTotal = Number(target?.page?.total);
  if (Number.isFinite(pageCurrent) && Number.isFinite(pageTotal) && pageCurrent > 0 && pageTotal > 0) {
    parts.push(lang === "en" ? `page ${Math.trunc(pageCurrent)}/${Math.trunc(pageTotal)}` : `pagina ${Math.trunc(pageCurrent)}/${Math.trunc(pageTotal)}`);
  }

  const chunkCurrent = Number(target?.chunk?.current ?? counters?.chunks_done);
  const chunkTotal = Number(target?.chunk?.total ?? counters?.chunks_total);
  if (Number.isFinite(chunkCurrent) && Number.isFinite(chunkTotal) && chunkCurrent > 0 && chunkTotal > 0) {
    parts.push(lang === "en" ? `chunks ${Math.trunc(chunkCurrent)}/${Math.trunc(chunkTotal)}` : `chunks ${Math.trunc(chunkCurrent)}/${Math.trunc(chunkTotal)}`);
  }

  if (!parts.length) return "";
  return ` (${parts.join(" | ")})`;
}

export class ProgressMessageFactory {
  build(input: ProgressMessageInput) {
    const language = resolveLanguageTag(input.langTag);
    const dict = language === "en" ? STAGE_TEMPLATES_EN : STAGE_TEMPLATES_PT;
    const templates = dict[input.stage] || dict.FINALIZE;
    const seed = `${input.requestId}:${input.stage}:${input.substage || "default"}`;
    const template = stablePick(templates, seed);
    const docName = normalizeName(input.target?.doc_name || input.target?.section || input.target?.chapter);
    const goal = normalizeGoal(input.userGoalShort);
    const rendered = interpolate(template, { docName, goal });
    return `${rendered}${buildCounterSuffix(input.counters, input.target, language)}`.trim();
  }
}
