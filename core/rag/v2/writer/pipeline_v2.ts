import type { RagChatHistoryItem, VllmInternalClient } from "@/core/rag/vllm-client";
import { HybridRetrieverV2 } from "@/core/rag/v2/retrieval/hybrid_v2";
import { ContextPackagerV2 } from "@/core/rag/v2/context/packager_v2";
import { ProcessStoreV2, type ProcessStateV2 } from "@/core/rag/v2/memory/process_store_v2";

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
  llmClient: VllmInternalClient;
  history?: RagChatHistoryItem[];
  maxTokens: number;
  temperature: number;
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

function hasDeepSignal(prompt: string) {
  const normalized = normalizeText(prompt).toLowerCase();
  return /\b(explicar|explique|detalhe|aprofunde|analise|analisar|compare|consequenc|causas?|impactos?|riscos?|estrategia|plano|roteiro)\b/.test(
    normalized,
  );
}

function inferOutline(prompt: string): WriterSectionPlan[] {
  const normalized = normalizeText(prompt);
  if (!normalized) {
    return [
      { title: "Introducao", objective: "Contextualizar tema e objetivo da resposta.", targetParagraphs: 1 },
      { title: "Pontos Centrais", objective: "Apresentar os conceitos essenciais.", targetParagraphs: 1 },
      { title: "Implicacoes", objective: "Explicar implicacoes praticas.", targetParagraphs: 1 },
      { title: "Sintese", objective: "Concluir com resumo objetivo.", targetParagraphs: 1 },
    ];
  }

  if (hasDeepSignal(normalized) || normalized.length >= 140) {
    return [
      { title: "Contexto", objective: "Definir o tema e os conceitos fundamentais.", targetParagraphs: 1 },
      { title: "Mecanismos", objective: "Explicar como o fenomeno ocorre na pratica.", targetParagraphs: 1 },
      { title: "Consequencias", objective: "Descrever efeitos, riscos e implicacoes.", targetParagraphs: 1 },
      { title: "Diagnostico e Monitoramento", objective: "Cobrir sinais, avaliacao e acompanhamento.", targetParagraphs: 1 },
      { title: "Mitigacao", objective: "Apontar medidas, estrategias e cuidados recomendados.", targetParagraphs: 1 },
      { title: "Sintese Final", objective: "Consolidar conclusoes e orientar proximos passos.", targetParagraphs: 1 },
    ];
  }

  return [
    { title: "Contexto", objective: "Definir escopo e conceitos centrais.", targetParagraphs: 1 },
    { title: "Analise", objective: "Desenvolver mecanismos, evidencias e implicacoes.", targetParagraphs: 1 },
    { title: "Aplicacao", objective: "Traduzir a analise para uso pratico.", targetParagraphs: 1 },
    { title: "Sintese", objective: "Consolidar conclusoes e proximos passos.", targetParagraphs: 1 },
  ];
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
    const plan = inferOutline(input.prompt);
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

    for (const section of plan) {
      const sectionQuery = `${input.prompt}\nSecao: ${section.title}\nObjetivo: ${section.objective}`;
      const retrieval = await this.retriever.search({
        queryText: sectionQuery,
        queryVector: input.queryVector,
          topK: 10,
          mmrEnabled: true,
        });
      const packed = this.packager.pack({
        question: sectionQuery,
        hits: retrieval.hits,
        maxContextChars: 8_000,
        contextBudgetTokens: 1_600,
        answerBudgetTokens: Math.max(256, Math.trunc(input.maxTokens / Math.max(plan.length, 1))),
        safetyMarginTokens: 192,
      });
      const response = await input.llmClient.completeWithContext({
        question: [
          `Escreva a secao '${section.title}' com foco em: ${section.objective}.`,
          `Alvo: ${section.targetParagraphs} paragrafo(s) objetivo(s), sem repetir argumentos ja usados.`,
          `Argumentos usados anteriormente: ${(sharedState.usedArguments || []).slice(-8).join(" | ") || "nenhum"}.`,
        ].join(" "),
        contextPack: packed.packedText,
        history: input.history || [],
        maxTokens: Math.max(256, Math.trunc(input.maxTokens / Math.max(plan.length, 1))),
        temperature: input.temperature,
        seed: null,
      });
      addUsage(usageAggregate, response.usage, response.model || null);
      sectionDrafts.push({ title: section.title, content: response.answer, usedChunks: packed.selected.length });
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

    const sectionBundle = sectionDrafts.map((row) => `## ${row.title}\n\n${row.content}`).join("\n\n");
    const mergeResponse = await input.llmClient.completeWithContext({
      question: [
        "Consolide as secoes em um texto unico, coeso e sem repeticoes.",
        "Entregue uma resposta final aprofundada em 5 a 8 paragrafos curtos quando o tema exigir detalhe.",
        "Mantenha consistencia entre secoes e preserve fatos essenciais.",
      ].join(" "),
      contextPack: sectionBundle,
      history: input.history || [],
      maxTokens: Math.max(512, input.maxTokens),
      temperature: Math.max(0, Math.min(1.2, input.temperature)),
      seed: null,
    });
    addUsage(usageAggregate, mergeResponse.usage, mergeResponse.model || null);
    const mergedText = `${mergeResponse.answer || ""}`.trim() || sectionBundle;

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
