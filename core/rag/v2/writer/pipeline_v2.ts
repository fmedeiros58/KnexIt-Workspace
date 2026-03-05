import type { RagChatHistoryItem, VllmInternalClient } from "@/core/rag/vllm-client";
import { HybridRetrieverV2 } from "@/core/rag/v2/retrieval/hybrid_v2";
import { ContextPackagerV2 } from "@/core/rag/v2/context/packager_v2";
import { ProcessStoreV2, type ProcessStateV2 } from "@/core/rag/v2/memory/process_store_v2";
import { RagPipelineError } from "@/core/rag/rag-errors";
import { resolveComposerLanguageDecision, resolveLanguageById } from "@/core/rag/language/language_intent";
import {
  buildConstructionRulesDirective,
  resolveConstructionRules,
} from "@/core/rag/v2/writer/construction_rules_orchestrator";
import {
  assessDocumentGrounding,
  buildGroundingInstruction,
} from "@/core/rag/v2/writer/document_grounding_orchestrator";
import {
  buildWriterResponseRepairInstruction,
  evaluateWriterResponseContract,
} from "@/core/rag/v2/writer/response_contract";
import { resolveDynamicTokenBudget } from "@/core/rag/v2/writer/token_budget_orchestrator";

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

function normalizeText(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
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
    /proxima melhoria sugerida\s*:/.test(normalized)
  );
}

function hasProcessLeakageHeadings(text: string) {
  const normalized = `${text || ""}`.toLowerCase().trim();
  return /^resposta\s*:/.test(normalized) || /resposta final\s*:/.test(normalized);
}

function promptExplicitlyRequestsFollowupSection(prompt: string) {
  const normalized = normalizeText(prompt)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return /\bproxima melhoria sugerida\b/.test(normalized);
}

function sanitizeMergedText(raw: string, keepFollowupSection: boolean) {
  let text = `${raw || ""}`.trim();
  if (!text) return "";
  text = text
    .replace(/\[(?:doc|DOC)\s*=?\s*\d+[^\]]*\]/g, "")
    .replace(/\bDOC\s*=\s*\d+\s*CHUNK\s*=\s*\d+\b/gi, "")
    .replace(/\bCHUNK\s*=\s*\d+\b/gi, "")
    .replace(/\bPAGES?\s*=\s*[0-9\-]+\b/gi, "")
    .replace(/\s{2,}/g, " ");
  text = text
    .replace(/^\s*resposta(?:\s+(?:final|principal))?\s*:\s*/i, "")
    .replace(/^\s*final answer\s*:\s*/i, "")
    .trim();
  if (!keepFollowupSection) {
    text = text.replace(/\n{0,2}\s*(?:pr[oó]xima melhoria sugerida|next suggested improvement)\s*:[\s\S]*$/i, "").trim();
  }
  if (!keepFollowupSection) {
    const folded = text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    const markerRegex = /(?:^|\n)\s*(?:proxima melhoria sugerida|next suggested improvement)\s*:/i;
    const markerMatch = markerRegex.exec(folded);
    if (markerMatch && Number.isFinite(markerMatch.index)) {
      text = text.slice(0, Math.max(0, markerMatch.index)).trim();
    }
  }
  return text;
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
    const languageDecisionFromPrompt = resolveComposerLanguageDecision(input.prompt);
    const preferredLanguage = resolveLanguageById(`${input.preferredResponseLanguageId || ""}`);
    const languageDecision = preferredLanguage
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
    const originalQuestionAnchor = [
      `Pergunta original do usuario: ${normalizeText(input.prompt)}`,
      `Idioma obrigatorio: ${languageDecision.name} (LANGUAGE_ID=${languageDecision.id}).`,
      languageDecision.explicitOverride
        ? "O usuario solicitou explicitamente idioma/ traducao. Respeite integralmente esse override."
        : "Nao mude o idioma da resposta sem pedido explicito do usuario.",
    ].join(" ");
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
        originalQuestionAnchor,
        `Secao: ${section.title}`,
        `Objetivo: ${section.objective}`,
        "Escreva no mesmo idioma da pergunta original.",
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
        const relaxedRetrieval = fallbackRetrieval;
        const relaxedGrounding = assessDocumentGrounding({
          question: input.prompt,
          sectionTitle: section.title,
          sectionObjective: section.objective,
          hits: relaxedRetrieval.hits,
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
      const response = await input.llmClient.completeWithContext({
        question: [
          originalQuestionAnchor,
          `Escreva a secao '${section.title}' com foco em: ${section.objective}.`,
          `Alvo: ${section.targetParagraphs} paragrafo(s) conectados e claros, sem repetir argumentos ja usados.`,
          `Cada paragrafo deve ter no minimo ${constructionRules.targetSentencesPerParagraphMin} frases completas e desenvolvimento robusto (evite paragrafo curto/telegrafico).`,
          `Argumentos usados anteriormente: ${(sharedState.usedArguments || []).slice(-8).join(" | ") || "nenhum"}.`,
          groundingDirective,
          constructionDirective,
          "Foque no pedido do usuario; nao descreva o processo de escrita, consolidacao, prompt, contexto ou instrucoes internas.",
          "Nao use cabecalhos fixos como 'Resposta principal' ou 'Proxima melhoria sugerida' nesta etapa.",
          `Mantenha exatamente o idioma configurado em LANGUAGE_ID=${languageDecision.id}.`,
          "Nao inclua a secao 'Proxima melhoria sugerida' neste bloco intermediario.",
        ].join(" "),
        contextPack: packed.packedText,
        history: input.history || [],
        maxTokens: sectionMaxTokens,
        temperature: input.temperature,
        seed: null,
        followupMode: "omit",
        responseLanguageId: languageDecision.id,
        responseLanguageName: languageDecision.name,
        responseLanguageSource: languageDecision.source,
        responseLanguageExplicitOverride: languageDecision.explicitOverride,
        responseLanguageIsTranslationIntent: languageDecision.isTranslationIntent,
      });
      addUsage(usageAggregate, response.usage, response.model || null);
      sectionDrafts.push({ title: section.title, content: response.answer, usedChunks: packed.selected.length });
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

    const sectionBundle = sectionDrafts.map((row) => `## ${row.title}\n\n${row.content}`).join("\n\n");
    await emitProgress({
      stage: "merge_start",
      message: "Organizando síntese final para iniciar a redação.",
      sectionTotal: plan.length,
    });
    const mergeQuestion = [
      originalQuestionAnchor,
      "Escreva a resposta final para a pergunta original, com coerencia, foco e progressao logica entre ideias.",
      "Nao descreva o processo interno de consolidacao e nao cite instrucoes, secoes, contexto recuperado ou prompt.",
      "Nao use cabecalhos fixos como 'Resposta principal' ou 'Proxima melhoria sugerida', salvo se o usuario pedir explicitamente.",
      groundingDirective,
      constructionDirective,
      `Entrega esperada: ${constructionRules.targetParagraphsMin} a ${constructionRules.targetParagraphsMax} paragrafos com ${constructionRules.targetSentencesPerParagraphMin} a ${constructionRules.targetSentencesPerParagraphMax} frases por paragrafo.`,
      "Evite paragrafos curtos: desenvolva cada paragrafo com progressao argumentativa completa.",
      deepMode
        ? "Entregue resposta aprofundada cobrindo fundamento, mecanismo, implicacoes, limites e orientacao pratica."
        : "Entregue resposta clara, estruturada e analitica.",
      "Abra com resposta direta ao pedido do usuario e depois desenvolva com exemplos relevantes ao tema.",
      `Mantenha exatamente o idioma configurado em LANGUAGE_ID=${languageDecision.id} (${languageDecision.name}).`,
    ].join(" ");
    const mergeMaxTokens = lockTokenBudget(input.maxTokens, budgetPlan.mergeMinTokens, budgetPlan.mergeMaxTokens);
    let mergedText = "";
    if (input.onFinalDelta) {
      const stream = await input.llmClient.streamWithContext({
        question: mergeQuestion,
        contextPack: sectionBundle,
        history: input.history || [],
        maxTokens: mergeMaxTokens,
        temperature: Math.max(0, Math.min(1.2, input.temperature)),
        seed: null,
        followupMode: "omit",
        responseLanguageId: languageDecision.id,
        responseLanguageName: languageDecision.name,
        responseLanguageSource: languageDecision.source,
        responseLanguageExplicitOverride: languageDecision.explicitOverride,
        responseLanguageIsTranslationIntent: languageDecision.isTranslationIntent,
      });
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let streamed = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const delta = decoder.decode(value, { stream: true });
        if (!delta) continue;
        streamed += delta;
        await input.onFinalDelta(delta);
      }
      const tail = decoder.decode();
      if (tail) {
        streamed += tail;
        await input.onFinalDelta(tail);
      }
      reader.releaseLock();
      mergedText = `${streamed || ""}`.trim();
      addUsage(
        usageAggregate,
        {
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
        },
        input.llmClient.getConfig().model || null,
      );
    } else {
      const mergeResponse = await input.llmClient.completeWithContext({
        question: mergeQuestion,
        contextPack: sectionBundle,
        history: input.history || [],
        maxTokens: mergeMaxTokens,
        temperature: Math.max(0, Math.min(1.2, input.temperature)),
        seed: null,
        followupMode: "omit",
        responseLanguageId: languageDecision.id,
        responseLanguageName: languageDecision.name,
        responseLanguageSource: languageDecision.source,
        responseLanguageExplicitOverride: languageDecision.explicitOverride,
        responseLanguageIsTranslationIntent: languageDecision.isTranslationIntent,
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
    if (requiresRepair && !input.onFinalDelta) {
      const contractRepairDirective = hasContractViolation
        ? buildWriterResponseRepairInstruction(contractEvaluation, { hasDocumentScope, deepMode })
        : "";
      const repair = await input.llmClient.completeWithContext({
        question: [
          originalQuestionAnchor,
          "Reescreva a resposta para o usuario com foco no problema real e sem meta-comentarios.",
          "Nao mencione consolidacao, secoes, prompt, contexto recuperado ou instrucoes internas.",
          deepMode
            ? "Aumente a profundidade com explicacao causal e implicacoes praticas mantendo coesao."
            : "Aumente a clareza e o encadeamento logico mantendo objetividade.",
          `Respeite LANGUAGE_ID=${languageDecision.id} (${languageDecision.name}).`,
          groundingDirective,
          constructionDirective,
          "Nao use o titulo 'Resposta principal'.",
          contractRepairDirective,
        ].join(" "),
        contextPack: mergedText || sectionBundle,
        history: input.history || [],
        maxTokens: mergeMaxTokens,
        temperature: Math.max(0, Math.min(1.0, input.temperature)),
        seed: null,
        followupMode: "omit",
        responseLanguageId: languageDecision.id,
        responseLanguageName: languageDecision.name,
        responseLanguageSource: languageDecision.source,
        responseLanguageExplicitOverride: languageDecision.explicitOverride,
        responseLanguageIsTranslationIntent: languageDecision.isTranslationIntent,
      });
      addUsage(usageAggregate, repair.usage, repair.model || null);
      mergedText = `${repair.answer || ""}`.trim() || mergedText;
    }
    mergedText = sanitizeMergedText(mergedText, promptExplicitlyRequestsFollowupSection(input.prompt));
    if (!mergedText) mergedText = sectionBundle;
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
