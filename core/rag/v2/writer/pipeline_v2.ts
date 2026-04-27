
import type { RagChatHistoryItem, VllmInternalClient } from "../../vllm-client";
import { HybridRetrieverV2 } from "../retrieval/hybrid_v2";
import { ContextPackagerV2 } from "../context/packager_v2";
import { ProcessStoreV2, type ProcessStateV2 } from "../memory/process_store_v2";
import { RagPipelineError } from "../../rag-errors";
import { resolveComposerLanguageDecision, resolveLanguageById } from "../../language/language_intent";
import {
  buildConstructionRulesDirective,
  resolveConstructionRules,
} from "./construction_rules_orchestrator";
import {
  assessDocumentGrounding,
  buildGroundingInstruction,
} from "./document_grounding_orchestrator";
import {
  buildWriterResponseRepairInstruction,
  evaluateWriterResponseContract,
} from "./response_contract";
import { resolveDynamicTokenBudget } from "./token_budget_orchestrator";

type WriterSectionPlan = {
  title: string;
  objective: string;
  targetParagraphs: number;
};

export type WriterPipelineInput = {
  conversationId: string;
  runId: string;
  prompt: string;
  queryVector: number[] | null;
  documentId?: number;
  documentIds?: number[];
  priorityDocumentIds?: number[];
  sourceType?: string;
  retrievalEmbeddingModel?: string;
  preferredResponseLanguageId?: string;
  strictDocumentGrounding?: boolean;
  maxDistance?: number | null;
  llmClient: VllmInternalClient;
  history?: RagChatHistoryItem[];
  maxTokens: number;
  temperature: number;
  anmEngineMode?: "direct" | "ai_system_anm";
  anmBaseUrl?: string;
  anmTimeoutMs?: number;
  anmSoftTimeoutMs?: number;
  anmFallbackToDirect?: boolean;
  onProgress?: (event: WriterPipelineProgressEvent) => void | Promise<void>;
  onFinalDelta?: (delta: string) => void | Promise<void>;
};

export type WriterPipelineProgressEvent = {
  stage: "planning" | "section_start" | "section_done" | "merge_start" | "merge_done";
  message: string;
  sectionIndex?: number;
  sectionTotal?: number;
  sectionTitle?: string;
};

export type WriterPipelineResult = {
  plan: WriterSectionPlan[];
  sectionDrafts: Array<{ title: string; content: string; usedChunks: number }>;
  mergedText: string;
  usage: {
    llmCalls: number;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    model: string | null;
    elapsedMs: number;
  };
};

type WriterLanguageDecision = ReturnType<typeof resolveComposerLanguageDecision>;

function normalizeText(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function normalizeMultilineText(value: string) {
  return `${value || ""}`
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeDocumentId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : undefined;
}

function normalizeDocumentIds(values: unknown, maxItems = 64) {
  if (!Array.isArray(values)) return [];
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of values) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    const item = Math.trunc(parsed);
    if (item <= 0 || seen.has(item)) continue;
    seen.add(item);
    normalized.push(item);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
}

function isDeepPrompt(prompt: string) {
  return hasDeepSignal(prompt) || normalizeText(prompt).length >= 140;
}

function resolveLockedSectionTokenRange(isDeep: boolean) {
  const minDefault = isDeep ? 1200 : 900;
  const maxDefault = isDeep ? 3200 : 2400;
  const minTokens = parsePositiveInt(process.env.RAG_V2_WRITER_SECTION_MIN_TOKENS, minDefault, 512, 4096);
  const maxTokens = parsePositiveInt(process.env.RAG_V2_WRITER_SECTION_MAX_TOKENS, maxDefault, 1024, 6144);
  return {
    minTokens: Math.min(minTokens, maxTokens),
    maxTokens: Math.max(minTokens, maxTokens),
  };
}

function resolveLockedMergeTokenRange(isDeep: boolean) {
  const minDefault = isDeep ? 1800 : 1200;
  const maxDefault = isDeep ? 3800 : 3000;
  const minTokens = parsePositiveInt(process.env.RAG_V2_WRITER_MERGE_MIN_TOKENS, minDefault, 768, 6144);
  const maxTokens = parsePositiveInt(process.env.RAG_V2_WRITER_MERGE_MAX_TOKENS, maxDefault, 1200, 8192);
  return {
    minTokens: Math.min(minTokens, maxTokens),
    maxTokens: Math.max(minTokens, maxTokens),
  };
}

function lockTokenBudget(requested: number, minTokens: number, maxTokens: number) {
  const safeRequested = Number.isFinite(requested) ? Math.trunc(requested) : maxTokens;
  return Math.max(minTokens, Math.min(maxTokens, safeRequested));
}

function hasProcessLeakage(text: string) {
  const normalized = `${text || ""}`.toLowerCase();
  return (
    /resposta principal\s*:/.test(normalized) ||
    /consolidate the sections/.test(normalized) ||
    /consolida[cr].*se[cç][oõ]es/.test(normalized) ||
    /texto unico[, ]+coeso/.test(normalized) ||
    /proxima melhoria sugerida\s*:/.test(normalized) ||
    /pergunta original do usuario/.test(normalized) ||
    /language_id=/.test(normalized) ||
    /nao use cabecalhos fixos/.test(normalized)
  );
}

function hasProcessLeakageHeadings(text: string) {
  const normalized = `${text || ""}`.toLowerCase().trim();
  return (
    /^resposta\s*:/.test(normalized) ||
    /^resposta final\s*:/.test(normalized) ||
    /^pergunta original\b/.test(normalized) ||
    /^idioma obrigatorio\b/.test(normalized)
  );
}

function promptExplicitlyRequestsFollowupSection(prompt: string) {
  const normalized = normalizeText(prompt)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return /\bproxima melhoria sugerida\b/.test(normalized);
}

function stripInlineProcessMarkers(text: string) {
  return `${text || ""}`
    .replace(/\[(?:doc|DOC)\s*=?\s*\d+[^\]]*\]/g, "")
    .replace(/\bDOC\s*=\s*\d+\s*CHUNK\s*=\s*\d+\b/gi, "")
    .replace(/\bCHUNK\s*=\s*\d+\b/gi, "")
    .replace(/\bPAGES?\s*=\s*[0-9\-]+\b/gi, "")
    .replace(/\bLANGUAGE_ID\s*=\s*[a-z-]+\b/gi, "")
    .replace(/\bLANGUAGE_NAME\s*=\s*[^.\n]+/gi, "")
    .replace(/\bLANGUAGE_POLICY\s*=\s*[^.\n]+/gi, "")
    .replace(/\bLANGUAGE_SOURCE\s*=\s*[^.\n]+/gi, "")
    .replace(/\bLANGUAGE_EXPLICIT_OVERRIDE\s*=\s*(?:true|false)\b/gi, "")
    .replace(/\bLANGUAGE_TRANSLATION_INTENT\s*=\s*(?:true|false)\b/gi, "");
}

function sanitizeMergedText(raw: string, keepFollowupSection: boolean) {
  let text = normalizeMultilineText(stripInlineProcessMarkers(raw));
  if (!text) return "";

  text = text
    .replace(/^\s*resposta(?:\s+(?:final|principal))?\s*:\s*/i, "")
    .replace(/^\s*final answer\s*:\s*/i, "")
    .replace(/^\s*pergunta original(?: do usuario)?\s*:\s*/i, "")
    .trim();

  if (!keepFollowupSection) {
    text = text.replace(/\n{0,2}\s*(?:pr[oó]xima melhoria sugerida|next suggested improvement)\s*:[\s\S]*$/i, "").trim();
  }

  const folded = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const hardCutMarkers = [
    "nao use cabecalhos fixos",
    "nao inclua a secao",
    "foco no problema real",
    "respeite language_id",
    "pergunta original do usuario",
    "idioma obrigatorio",
  ];

  for (const marker of hardCutMarkers) {
    const index = folded.indexOf(marker);
    if (index >= 0) {
      text = text.slice(0, index).trim();
      break;
    }
  }

  return normalizeMultilineText(text);
}

function sanitizeIntermediateDraft(raw: string) {
  let text = sanitizeMergedText(raw, false);
  text = text
    .replace(/^##\s+/gm, "")
    .replace(/^\s*(?:contexto|analise|aplicacao|sintese final|sintese)\s*:\s*/gim, "")
    .trim();

  return normalizeMultilineText(text);
}

function hasDeepSignal(prompt: string) {
  const normalized = normalizeText(prompt).toLowerCase();
  return /\b(explicar|explique|detalhe|aprofunde|analise|analisar|resenha|critica|compare|consequenc|causas?|impactos?|riscos?|estrategia|plano|roteiro|dissertacao|tese|obra|capitulo|documento)\b/.test(
    normalized,
  );
}

function hasSimpleSignal(prompt: string) {
  const normalized = normalizeText(prompt).toLowerCase();
  const wordCount = normalized.split(/\s+/g).filter(Boolean).length;
  if (wordCount <= 3 && /\b(oi|ola|hello|hi)\b/.test(normalized)) return true;
  return /\b(oi|ola|bom dia|boa tarde|boa noite|resuma em uma frase|resumo curto|em uma frase|1 frase|uma frase)\b/.test(
    normalized,
  );
}

function inferOutline(prompt: string, options?: { hasDocumentScope?: boolean }): WriterSectionPlan[] {
  const normalized = normalizeText(prompt);
  if (!normalized) {
    return [
      { title: "Contexto", objective: "Contextualizar tema e objetivo da resposta.", targetParagraphs: 1 },
      { title: "Resposta Direta", objective: "Responder de forma objetiva e útil.", targetParagraphs: 1 },
    ];
  }

  if (hasSimpleSignal(normalized) && !options?.hasDocumentScope) {
    return [
      { title: "Contexto", objective: "Contextualizar de forma breve o tema solicitado.", targetParagraphs: 1 },
      { title: "Resposta Direta", objective: "Responder com foco prático e sem digressão.", targetParagraphs: 1 },
    ];
  }

  if (options?.hasDocumentScope || hasDeepSignal(normalized) || normalized.length >= 140) {
    return [
      { title: "Contexto", objective: "Definir o tema e os conceitos fundamentais.", targetParagraphs: 1 },
      { title: "Mecanismos", objective: "Explicar como o fenômeno ocorre na prática.", targetParagraphs: 2 },
      { title: "Consequências", objective: "Descrever efeitos, riscos e implicações.", targetParagraphs: 2 },
      { title: "Diagnóstico e Monitoramento", objective: "Cobrir sinais, avaliação e acompanhamento.", targetParagraphs: 1 },
      { title: "Mitigação", objective: "Apontar medidas, estratégias e cuidados recomendados.", targetParagraphs: 2 },
      { title: "Síntese Final", objective: "Consolidar conclusões e orientar próximos passos.", targetParagraphs: 1 },
    ];
  }

  return [
    { title: "Contexto", objective: "Definir escopo e conceitos centrais.", targetParagraphs: 1 },
    { title: "Análise", objective: "Desenvolver mecanismos, evidências e implicações.", targetParagraphs: 2 },
    { title: "Aplicação", objective: "Traduzir a análise para uso prático.", targetParagraphs: 1 },
    { title: "Síntese", objective: "Consolidar conclusões e próximos passos.", targetParagraphs: 1 },
  ];
}

function adaptPlanToRules(
  plan: WriterSectionPlan[],
  rules: { targetParagraphsMin: number; targetParagraphsMax: number; weights: { depth: number; verbosity: number } },
) {
  if (!plan.length) return plan;
  const idealTotal = Math.max(
    rules.targetParagraphsMin,
    Math.min(rules.targetParagraphsMax, Math.round((rules.targetParagraphsMin + rules.targetParagraphsMax) / 2)),
  );
  const currentTotal = plan.reduce((sum, row) => sum + Math.max(1, row.targetParagraphs), 0);
  const boostFactor = rules.weights.depth >= 80 || rules.weights.verbosity >= 80 ? 1.22 : 1.0;
  const scale = Math.max(0.8, Math.min(1.8, (idealTotal / Math.max(1, currentTotal)) * boostFactor));
  return plan.map((row) => ({
    ...row,
    targetParagraphs: Math.max(1, Math.min(4, Math.round(row.targetParagraphs * scale))),
  }));
}

function describeSectionStart(section: WriterSectionPlan) {
  return `Explorando caminho: ${section.objective}`;
}

function describeSectionDone(section: WriterSectionPlan) {
  return `Direção consolidada em: ${section.title}.`;
}

function addUsage(
  aggregate: {
    llmCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    hasUsage: boolean;
    model: string | null;
  },
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null },
  model: string | null,
) {
  aggregate.llmCalls += 1;
  if (model && !aggregate.model) aggregate.model = model;
  if (usage.promptTokens !== null || usage.completionTokens !== null || usage.totalTokens !== null) {
    aggregate.hasUsage = true;
  }
  aggregate.promptTokens += Number(usage.promptTokens || 0);
  aggregate.completionTokens += Number(usage.completionTokens || 0);
  aggregate.totalTokens += Number(usage.totalTokens || 0);
}

function sanitizeHistoryForWriter(history?: RagChatHistoryItem[]) {
  if (!Array.isArray(history) || !history.length) return [];

  const sanitized: RagChatHistoryItem[] = [];
  for (const row of history) {
    if (!row || (row.role !== "user" && row.role !== "assistant")) continue;

    let content = normalizeMultilineText(`${row.content || ""}`);
    if (!content) continue;

    content = content
      .replace(
        /\b(?:usuário|usuario|user|assistente|assistant|sistema|system|let[ií]cia|humano|ai|modelo)\s*:\s*/gi,
        "",
      )
      .replace(/\[\[KNX_EVT\]\][\s\S]*?\[\[\/KNX_EVT\]\]/g, " ")
      .replace(/\[PASSO\s+\d+\/\d+\][^\n]*/gi, " ")
      .replace(/\[continuidade passo\s+\d+\/\d+\]/gi, " ")
      .trim();

    if (!content) continue;

    const previous = sanitized[sanitized.length - 1];
    if (previous && previous.role === row.role) {
      sanitized[sanitized.length - 1] = { role: row.role, content };
      continue;
    }

    sanitized.push({ role: row.role, content });
  }

  while (sanitized.length > 0 && sanitized[sanitized.length - 1]?.role === "user") {
    sanitized.pop();
  }

  return sanitized.slice(-8);
}

function sanitizePackedContext(raw: string) {
  return normalizeMultilineText(
    `${raw || ""}`
      .replace(/\bLANGUAGE_ID\s*=\s*[a-z-]+\b/gi, "")
      .replace(/\bLANGUAGE_NAME\s*=\s*[^.\n]+/gi, "")
      .replace(/\[\[KNX_EVT\]\][\s\S]*?\[\[\/KNX_EVT\]\]/g, "\n"),
  );
}

function buildResponseLanguageContext(languageDecision: WriterLanguageDecision) {
  return [
    `Responda integralmente em ${languageDecision.name}.`,
    "Não mude de idioma ao longo da resposta.",
    languageDecision.explicitOverride
      ? "O idioma foi definido explicitamente pelo usuário e deve ser respeitado sem exceções."
      : "Mantenha o idioma da pergunta original.",
  ].join(" ");
}

function buildCommonWriterGuardrails(input: {
  languageDecision: WriterLanguageDecision;
  constructionDirective: string;
  groundingDirective: string;
  deepMode: boolean;
}) {
  return [
    buildResponseLanguageContext(input.languageDecision),
    input.groundingDirective,
    input.constructionDirective,
    input.deepMode
      ? "Aprofunde com explicação causal, implicações e limites, sem metacomentários."
      : "Mantenha clareza, progressão lógica e foco direto no pedido.",
    "Não mencione processo interno, seções, consolidacão, prompt, contexto recuperado ou instruções.",
    "Não use rótulos como 'Resposta principal', 'Resposta final', 'Pergunta original' ou similares.",
    "Não descreva o que você vai fazer; apenas entregue o conteúdo solicitado.",
  ].join(" ");
}

function buildSectionQuestion(input: {
  prompt: string;
  section: WriterSectionPlan;
  languageDecision: WriterLanguageDecision;
  constructionDirective: string;
  groundingDirective: string;
  deepMode: boolean;
  usedArguments: string[];
}) {
  const usedArguments = input.usedArguments.slice(-8).join(" | ") || "nenhum ainda";
  return [
    `Pedido do usuário: ${normalizeText(input.prompt)}.`,
    `Escreva apenas a seção "${input.section.title}" com foco em ${input.section.objective}.`,
    `Meta de extensão: ${input.section.targetParagraphs} parágrafo(s) consistentes.`,
    `Evite repetir estes argumentos já usados: ${usedArguments}.`,
    buildCommonWriterGuardrails({
      languageDecision: input.languageDecision,
      constructionDirective: input.constructionDirective,
      groundingDirective: input.groundingDirective,
      deepMode: input.deepMode,
    }),
  ].join(" ");
}

function buildMergeQuestion(input: {
  prompt: string;
  languageDecision: WriterLanguageDecision;
  constructionDirective: string;
  groundingDirective: string;
  deepMode: boolean;
}) {
  return [
    `Pedido do usuário: ${normalizeText(input.prompt)}.`,
    "Escreva a resposta final em texto corrido, coeso e natural, unificando as evidências e ideias relevantes.",
    "Abra respondendo diretamente ao que foi pedido e depois desenvolva a explicação.",
    input.deepMode
      ? "Entregue resposta aprofundada cobrindo fundamento, mecanismo, implicações, limites e orientação prática."
      : "Entregue resposta clara, estruturada e analítica.",
    buildCommonWriterGuardrails({
      languageDecision: input.languageDecision,
      constructionDirective: input.constructionDirective,
      groundingDirective: input.groundingDirective,
      deepMode: input.deepMode,
    }),
  ].join(" ");
}

function buildRepairQuestion(input: {
  prompt: string;
  languageDecision: WriterLanguageDecision;
  constructionDirective: string;
  groundingDirective: string;
  deepMode: boolean;
  contractRepairDirective: string;
}) {
  return [
    `Pedido do usuário: ${normalizeText(input.prompt)}.`,
    "Reescreva a resposta final para que ela fique natural, direta, útil e sem vazamento de instruções internas.",
    input.deepMode
      ? "Aumente profundidade, densidade argumentativa e coerência global, sem repetir trechos."
      : "Aumente clareza, foco e encadeamento lógico, sem repetir trechos.",
    buildCommonWriterGuardrails({
      languageDecision: input.languageDecision,
      constructionDirective: input.constructionDirective,
      groundingDirective: input.groundingDirective,
      deepMode: input.deepMode,
    }),
    input.contractRepairDirective,
  ]
    .filter(Boolean)
    .join(" ");
}

function chunkTextForEmission(text: string, chunkSize = 400) {
  const normalized = `${text || ""}`;
  const chunks: string[] = [];
  for (let cursor = 0; cursor < normalized.length; cursor += chunkSize) {
    chunks.push(normalized.slice(cursor, Math.min(normalized.length, cursor + chunkSize)));
  }
  return chunks;
}

async function readStreamToText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || !value.length) continue;
      output += decoder.decode(value, { stream: true });
    }
    const tail = decoder.decode();
    if (tail) output += tail;
  } finally {
    reader.releaseLock();
  }

  return normalizeMultilineText(output);
}

async function emitSanitizedFinalText(
  text: string,
  onFinalDelta?: (delta: string) => void | Promise<void>,
) {
  if (!onFinalDelta) return;
  for (const chunk of chunkTextForEmission(text)) {
    if (!chunk) continue;
    await onFinalDelta(chunk);
  }
}

function buildSectionBundle(sectionDrafts: Array<{ title: string; content: string }>) {
  return normalizeMultilineText(
    sectionDrafts
      .map((row) => `${row.title}\n${sanitizeIntermediateDraft(row.content)}`)
      .join("\n\n"),
  );
}

export class WriterPipelineV2 {
  private readonly retriever = new HybridRetrieverV2();
  private readonly packager = new ContextPackagerV2();
  private readonly processStore = new ProcessStoreV2();

  async run(input: WriterPipelineInput): Promise<WriterPipelineResult> {
    const startedAt = Date.now();
    const scopedDocumentIds = normalizeDocumentIds(input.documentIds);
    const scopedDocumentId = normalizeDocumentId(input.documentId);
    const priorityDocumentIds = normalizeDocumentIds(input.priorityDocumentIds);
    const hasDocumentScope = scopedDocumentIds.length > 0 || Boolean(scopedDocumentId);
    const strictDocumentGrounding = input.strictDocumentGrounding ?? hasDocumentScope;
    const sanitizedHistory = sanitizeHistoryForWriter(input.history);

    const languageDecisionFromPrompt = resolveComposerLanguageDecision(input.prompt);
    const preferredLanguage = resolveLanguageById(`${input.preferredResponseLanguageId || ""}`);
    const languageDecision: WriterLanguageDecision = preferredLanguage
      ? {
          ...languageDecisionFromPrompt,
          id: preferredLanguage.id,
          name: preferredLanguage.name,
          source: "explicit_override" as const,
          explicitOverride: true,
        }
      : languageDecisionFromPrompt;

    const deepSignal = isDeepPrompt(input.prompt);
    const constructionRules = resolveConstructionRules(input.prompt, {
      hasDocumentScope,
      deepMode: deepSignal || hasDocumentScope,
    });
    const deepMode = deepSignal || hasDocumentScope || constructionRules.weights.depth >= 78;
    const budgetPlan = resolveDynamicTokenBudget({
      requestedMaxTokens: input.maxTokens,
      deepMode,
      hasDocumentScope,
      rules: constructionRules,
    });
    const plan = adaptPlanToRules(inferOutline(input.prompt, { hasDocumentScope }), constructionRules);
    const constructionDirective = buildConstructionRulesDirective(constructionRules);
    const groundingDirective = buildGroundingInstruction(hasDocumentScope);

    const emitProgress = async (event: WriterPipelineProgressEvent) => {
      if (!input.onProgress) return;
      try {
        await input.onProgress(event);
      } catch {
        // best effort: progresso nao deve quebrar o fluxo principal
      }
    };

    await emitProgress({
      stage: "planning",
      message: `Planejamento iniciado: idioma=${languageDecision.id}, estilo=${constructionRules.citationStyle}, secoes=${plan.length}.`,
      sectionTotal: plan.length,
    });

    const sectionDrafts: Array<{ title: string; content: string; usedChunks: number }> = [];
    const usageAggregate = {
      llmCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      hasUsage: false,
      model: null as string | null,
    };

    const previousState = await this.processStore.getLatestByConversation(input.conversationId);
    let sharedState: ProcessStateV2 = {
      ...(previousState?.state || {}),
      theme: normalizeText(input.prompt).slice(0, 220),
      sectionStatus: {},
      usedArguments: [...((previousState?.state?.usedArguments as string[] | undefined) || [])],
      usedCitations: [...((previousState?.state?.usedCitations as ProcessStateV2["usedCitations"]) || [])],
    };

    const sectionMaxTokens = lockTokenBudget(input.maxTokens, budgetPlan.sectionMinTokens, budgetPlan.sectionMaxTokens);
    const sectionTopK = budgetPlan.sectionTopK;
    const scopedSourceType = normalizeText(input.sourceType || "") || undefined;
    const scopedEmbeddingModel = normalizeText(input.retrievalEmbeddingModel || "") || undefined;
    let totalSelectedEvidenceChunks = 0;
    let groundedSections = 0;

    for (let sectionIndex = 0; sectionIndex < plan.length; sectionIndex += 1) {
      const section = plan[sectionIndex];

      await emitProgress({
        stage: "section_start",
        message: describeSectionStart(section),
        sectionIndex: sectionIndex + 1,
        sectionTotal: plan.length,
        sectionTitle: section.title,
      });

      const sectionQuery = [
        normalizeText(input.prompt),
        `Seção: ${section.title}`,
        `Objetivo: ${section.objective}`,
      ].join("\n");

      const retrieval = await this.retriever.search({
        queryText: sectionQuery,
        queryVector: input.queryVector,
        topK: sectionTopK,
        maxDistance: input.maxDistance,
        documentId: scopedDocumentIds.length ? undefined : scopedDocumentId,
        documentIds: scopedDocumentIds.length ? scopedDocumentIds : undefined,
        priorityDocumentIds: priorityDocumentIds.length ? priorityDocumentIds : undefined,
        sourceType: scopedSourceType,
        embeddingModel: scopedEmbeddingModel,
        mmrEnabled: true,
        allowScopeFallback: !strictDocumentGrounding,
      });

      let grounding = assessDocumentGrounding({
        question: input.prompt,
        sectionTitle: section.title,
        sectionObjective: section.objective,
        hits: retrieval.hits,
        hasDocumentScope,
      });

      let hitsForPacking = grounding.groundedHits.length > 0 ? grounding.groundedHits : retrieval.hits;

      let packed = this.packager.pack({
        question: sectionQuery,
        hits: hitsForPacking,
        maxContextChars: 8_000,
        contextBudgetTokens: budgetPlan.contextBudgetTokens,
        answerBudgetTokens: sectionMaxTokens,
        safetyMarginTokens: 192,
      });

      if (strictDocumentGrounding && (!grounding.isGrounded || packed.selected.length === 0)) {
        const fallbackRetrieval = await this.retriever.search({
          queryText: [normalizeText(input.prompt), section.title, section.objective, "evidencia textual"].join(" "),
          queryVector: input.queryVector,
          topK: Math.max(sectionTopK, 18),
          maxDistance: input.maxDistance,
          documentId: scopedDocumentIds.length ? undefined : scopedDocumentId,
          documentIds: scopedDocumentIds.length ? scopedDocumentIds : undefined,
          priorityDocumentIds: priorityDocumentIds.length ? priorityDocumentIds : undefined,
          sourceType: scopedSourceType,
          embeddingModel: scopedEmbeddingModel,
          mmrEnabled: false,
          cacheEnabled: false,
          allowScopeFallback: false,
        });

        const relaxedGrounding = assessDocumentGrounding({
          question: input.prompt,
          sectionTitle: section.title,
          sectionObjective: section.objective,
          hits: fallbackRetrieval.hits,
          hasDocumentScope,
        });

        grounding = relaxedGrounding;
        hitsForPacking = relaxedGrounding.groundedHits.length > 0 ? relaxedGrounding.groundedHits : [];

        const fallbackPacked = this.packager.pack({
          question: sectionQuery,
          hits: hitsForPacking,
          maxContextChars: 12_000,
          contextBudgetTokens: Math.min(10_000, budgetPlan.contextBudgetTokens + 420),
          answerBudgetTokens: sectionMaxTokens,
          safetyMarginTokens: 192,
        });

        if (relaxedGrounding.isGrounded && fallbackPacked.selected.length > 0) {
          packed = fallbackPacked;
        }
      }

      if (strictDocumentGrounding && (!grounding.isGrounded || packed.selected.length === 0)) {
        await emitProgress({
          stage: "section_done",
          message: `Secao '${section.title}' sem aderencia forte ao documento: ${grounding.reason}`,
          sectionIndex: sectionIndex + 1,
          sectionTotal: plan.length,
          sectionTitle: section.title,
        });
        continue;
      }

      groundedSections += 1;
      totalSelectedEvidenceChunks += packed.selected.length;

      const sectionResponse = await input.llmClient.completeWithContext({
        question: buildSectionQuestion({
          prompt: input.prompt,
          section,
          languageDecision,
          constructionDirective,
          groundingDirective,
          deepMode,
          usedArguments: sharedState.usedArguments || [],
        }),
        contextPack: sanitizePackedContext(packed.packedText),
        history: sanitizedHistory,
        maxTokens: sectionMaxTokens,
        temperature: input.temperature,
        seed: null,
        followupMode: "omit",
        responseLanguageId: languageDecision.id,
        responseLanguageName: languageDecision.name,
        responseLanguageSource: languageDecision.source,
        responseLanguageExplicitOverride: languageDecision.explicitOverride,
        responseLanguageIsTranslationIntent: languageDecision.isTranslationIntent,
        anmEngineMode: input.anmEngineMode,
        anmBaseUrl: input.anmBaseUrl,
        anmTimeoutMs: input.anmTimeoutMs,
        anmSoftTimeoutMs: input.anmSoftTimeoutMs,
        anmFallbackToDirect: input.anmFallbackToDirect,
      });

      addUsage(usageAggregate, sectionResponse.usage, sectionResponse.model || null);

      const sanitizedSectionContent = sanitizeIntermediateDraft(sectionResponse.answer);
      sectionDrafts.push({
        title: section.title,
        content: sanitizedSectionContent,
        usedChunks: packed.selected.length,
      });

      await emitProgress({
        stage: "section_done",
        message: describeSectionDone(section),
        sectionIndex: sectionIndex + 1,
        sectionTotal: plan.length,
        sectionTitle: section.title,
      });

      sharedState.sectionStatus = {
        ...(sharedState.sectionStatus || {}),
        [section.title]: "done",
      };
      sharedState.usedArguments = [...(sharedState.usedArguments || []), section.title, section.objective];
      const cited = packed.selected.map((row) => ({
        docId: row.docId,
        chunkId: row.chunkId,
        pageStart: row.pageStart,
        pageEnd: row.pageEnd,
      }));
      sharedState.usedCitations = [...(sharedState.usedCitations || []), ...cited].slice(-200);

      await this.processStore.upsertCheckpoint({
        memoryId: `${input.conversationId}:writer-v2`,
        conversationId: input.conversationId,
        runId: input.runId,
        state: sharedState,
      });
    }

    if (strictDocumentGrounding && (totalSelectedEvidenceChunks === 0 || groundedSections === 0)) {
      throw new RagPipelineError(
        422,
        "RAG_DOCUMENT_SCOPE_NOT_GROUNDED",
        "Os trechos recuperados nao apresentaram aderencia suficiente ao pedido para o documento selecionado. Revise o comando ou aguarde a indexacao completa.",
      );
    }

    const sectionBundle = buildSectionBundle(sectionDrafts);

    await emitProgress({
      stage: "merge_start",
      message: "Organizando síntese final para iniciar a redação.",
      sectionTotal: plan.length,
    });

    const mergeQuestion = buildMergeQuestion({
      prompt: input.prompt,
      languageDecision,
      constructionDirective,
      groundingDirective,
      deepMode,
    });

    const mergeMaxTokens = lockTokenBudget(input.maxTokens, budgetPlan.mergeMinTokens, budgetPlan.mergeMaxTokens);

    let mergedText = "";

    if (input.onFinalDelta) {
      const stream = await input.llmClient.streamWithContext({
        question: mergeQuestion,
        contextPack: sectionBundle,
        history: sanitizedHistory,
        maxTokens: mergeMaxTokens,
        temperature: Math.max(0, Math.min(1.2, input.temperature)),
        seed: null,
        followupMode: "omit",
        responseLanguageId: languageDecision.id,
        responseLanguageName: languageDecision.name,
        responseLanguageSource: languageDecision.source,
        responseLanguageExplicitOverride: languageDecision.explicitOverride,
        responseLanguageIsTranslationIntent: languageDecision.isTranslationIntent,
        anmEngineMode: input.anmEngineMode,
        anmBaseUrl: input.anmBaseUrl,
        anmTimeoutMs: input.anmTimeoutMs,
        anmSoftTimeoutMs: input.anmSoftTimeoutMs,
        anmFallbackToDirect: input.anmFallbackToDirect,
      });

      const rawMerged = await readStreamToText(stream);
      addUsage(
        usageAggregate,
        {
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
        },
        input.llmClient.getConfig().model || null,
      );
      mergedText = rawMerged;
    } else {
      const mergeResponse = await input.llmClient.completeWithContext({
        question: mergeQuestion,
        contextPack: sectionBundle,
        history: sanitizedHistory,
        maxTokens: mergeMaxTokens,
        temperature: Math.max(0, Math.min(1.2, input.temperature)),
        seed: null,
        followupMode: "omit",
        responseLanguageId: languageDecision.id,
        responseLanguageName: languageDecision.name,
        responseLanguageSource: languageDecision.source,
        responseLanguageExplicitOverride: languageDecision.explicitOverride,
        responseLanguageIsTranslationIntent: languageDecision.isTranslationIntent,
        anmEngineMode: input.anmEngineMode,
        anmBaseUrl: input.anmBaseUrl,
        anmTimeoutMs: input.anmTimeoutMs,
        anmSoftTimeoutMs: input.anmSoftTimeoutMs,
        anmFallbackToDirect: input.anmFallbackToDirect,
      });

      addUsage(usageAggregate, mergeResponse.usage, mergeResponse.model || null);
      mergedText = `${mergeResponse.answer || ""}`.trim();
    }

    const contractEvaluation = evaluateWriterResponseContract({
      prompt: input.prompt,
      answer: mergedText,
      hasDocumentScope,
      deepMode,
    });

    const hasContractViolation = contractEvaluation.reasons.length > 0;
    const requiresRepair = hasProcessLeakage(mergedText) || hasProcessLeakageHeadings(mergedText) || hasContractViolation;

    if (requiresRepair) {
      const contractRepairDirective = hasContractViolation
        ? buildWriterResponseRepairInstruction(contractEvaluation, { hasDocumentScope, deepMode })
        : "";

      const repair = await input.llmClient.completeWithContext({
        question: buildRepairQuestion({
          prompt: input.prompt,
          languageDecision,
          constructionDirective,
          groundingDirective,
          deepMode,
          contractRepairDirective,
        }),
        contextPack: sanitizePackedContext(mergedText || sectionBundle),
        history: sanitizedHistory,
        maxTokens: mergeMaxTokens,
        temperature: Math.max(0, Math.min(1.0, input.temperature)),
        seed: null,
        followupMode: "omit",
        responseLanguageId: languageDecision.id,
        responseLanguageName: languageDecision.name,
        responseLanguageSource: languageDecision.source,
        responseLanguageExplicitOverride: languageDecision.explicitOverride,
        responseLanguageIsTranslationIntent: languageDecision.isTranslationIntent,
        anmEngineMode: input.anmEngineMode,
        anmBaseUrl: input.anmBaseUrl,
        anmTimeoutMs: input.anmTimeoutMs,
        anmSoftTimeoutMs: input.anmSoftTimeoutMs,
        anmFallbackToDirect: input.anmFallbackToDirect,
      });

      addUsage(usageAggregate, repair.usage, repair.model || null);
      mergedText = `${repair.answer || ""}`.trim() || mergedText;
    }

    mergedText = sanitizeMergedText(mergedText, promptExplicitlyRequestsFollowupSection(input.prompt));
    if (!mergedText) mergedText = sectionBundle;

    if (input.onFinalDelta) {
      await emitSanitizedFinalText(mergedText, input.onFinalDelta);
    }

    await emitProgress({
      stage: "merge_done",
      message: "Caminho consolidado. Iniciando entrega do texto final.",
      sectionTotal: plan.length,
    });

    await this.processStore.upsertCheckpoint({
      memoryId: `${input.conversationId}:writer-v2`,
      conversationId: input.conversationId,
      runId: input.runId,
      state: {
        ...sharedState,
        sectionStatus: Object.fromEntries(plan.map((row) => [row.title, "merged"])),
      },
    });

    return {
      plan,
      sectionDrafts,
      mergedText,
      usage: {
        llmCalls: usageAggregate.llmCalls,
        promptTokens: usageAggregate.hasUsage ? usageAggregate.promptTokens : null,
        completionTokens: usageAggregate.hasUsage ? usageAggregate.completionTokens : null,
        totalTokens: usageAggregate.hasUsage ? usageAggregate.totalTokens : null,
        model: usageAggregate.model,
        elapsedMs: Date.now() - startedAt,
      },
    };
  }
}
