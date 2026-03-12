import { RagQueryService } from "@/core/rag/rag-query-service";
import type { InternetSearchResponse } from "@/core/rag/internet-search-service";
import type { RagGenerationConfig, RagPipelineFlags, RagResilienceConfig } from "@/core/rag/rag-config";
import { RagPipelineError } from "@/core/rag/rag-errors";

function createTestService(input?: {
  searchResponse?: InternetSearchResponse | null;
  searchEnabled?: boolean;
  generationMaxTokens?: number;
  vectorRows?: Array<{
    id: string | number;
    title?: string | null;
    source_path?: string | null;
    original_filename?: string | null;
  }>;
}) {
  const llmClient = {
    getConfig: () => ({ baseUrl: "http://127.0.0.1:8000/v1" }),
    completeWithContext: jest.fn(async () => ({
      answer: "llm",
      model: "mistral-awq",
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      elapsedMs: 1,
    })),
    streamWithContext: jest.fn(async () => {
      const encoder = new TextEncoder();
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("llm"));
          controller.close();
        },
      });
    }),
  };

  const searchService = {
    isEnabled: () => input?.searchEnabled !== false,
    search: jest.fn(async () => input?.searchResponse ?? null),
  };
  const vectorDb = {
    query: jest.fn(async (_sql: string, params?: unknown[]) => {
      const requestedIds = Array.isArray(params?.[0])
        ? (params?.[0] as unknown[])
            .map((row) => Number(row))
            .filter((row) => Number.isFinite(row) && row > 0)
            .map((row) => Math.trunc(row))
        : [];
      const scoped = new Set<number>(requestedIds);
      const rows = (input?.vectorRows || []).filter((row) => scoped.has(Math.trunc(Number(row.id))));
      return { rows };
    }),
  };

  const generationConfig: RagGenerationConfig = {
    maxTokens: input?.generationMaxTokens ?? 1024,
    temperature: 0,
    seed: 42,
    historyMaxMessages: 8,
    historyMaxChars: 4000,
  };
  const resilienceConfig: RagResilienceConfig = {
    embeddingFailureMode: "degrade",
  };
  const pipelineFlags: RagPipelineFlags = {
    pipelineVersion: "v2",
    hybridEnabled: true,
    rerankEnabled: true,
    citationAlignmentEnabled: true,
    writeModeEnabled: true,
    ocrAutoEnabled: false,
    mmrEnabled: true,
    retrievalRunAuditEnabled: true,
    generationRunAuditEnabled: true,
    cacheEnabled: true,
  };

  const service = new RagQueryService(
    {} as any,
    {} as any,
    llmClient as any,
    {} as any,
    vectorDb as any,
    searchService as any,
    {
      generationConfig,
      resilienceConfig,
      contextConfig: { maxChars: 4000, maxChunks: 8 },
      pipelineFlags,
    },
  );

  return {
    service,
    llmClient,
    searchService,
    vectorDb,
  };
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

describe("RagQueryService local intent replies", () => {
  it("retorna saudacao curta sem chamar LLM", async () => {
    const { service, llmClient } = createTestService();
    const result = await service.query({ question: "oi" });
    expect(result.answer.toLowerCase()).toContain("oi");
    expect(result.metadata.llm.model).toContain("local_intent");
    expect(llmClient.completeWithContext).not.toHaveBeenCalled();
  });

  it("pede termo de busca quando comando vem sem consulta", async () => {
    const { service, llmClient } = createTestService();
    const result = await service.query({ question: "busque" });
    expect(result.answer.toLowerCase()).toContain("me diga o tema");
    expect(llmClient.completeWithContext).not.toHaveBeenCalled();
  });

  it("retorna links de busca quando comando explicito e encontrado", async () => {
    const { service, llmClient, searchService } = createTestService({
      searchResponse: {
        provider: "duckduckgo_html",
        providersUsed: ["duckduckgo_html"],
        query: "perspectiva heliocentrica pdf",
        elapsedMs: 35,
        results: [
          {
            title: "Heliocentric Theory",
            url: "https://example.org/heliocentric.pdf",
            snippet: "Documento de referencia",
            isPdf: true,
          },
        ],
      },
    });

    const result = await service.query({ question: "pode buscar na internet pdf sobre perspectiva heliocentrica" });
    expect(result.answer).toContain("https://example.org/heliocentric.pdf");
    expect(result.answer).toContain("[PDF]");
    expect(searchService.search).toHaveBeenCalled();
    expect(llmClient.completeWithContext).not.toHaveBeenCalled();
  });

  it("funciona no stream local para saudacao", async () => {
    const { service, llmClient } = createTestService();
    const stream = await service.queryStream({ question: "boa tarde" });
    const text = await readStream(stream);
    expect(text.toLowerCase()).toContain("pronto para ajudar");
    expect(llmClient.streamWithContext).not.toHaveBeenCalled();
  });

  it("pede clarificacao quando referencia singular e ha multiplos documentos no escopo", async () => {
    const { service, llmClient } = createTestService();
    const result = await service.query({
      question: "quero um resumo dessa obra",
      composerBound: true,
      composerAttachmentIds: [11, 22],
    });
    expect(result.answer.toLowerCase()).toContain("qual deles devo usar");
    expect(result.metadata.llm.model).toContain("local_intent");
    expect(llmClient.completeWithContext).not.toHaveBeenCalled();
  });

  it("converte erro de grounding em pergunta de clarificacao no v2", async () => {
    const previousForceMode = process.env.RAG_PIPELINE_FORCE_MODE;
    process.env.RAG_PIPELINE_FORCE_MODE = "full";
    try {
      const { service, llmClient } = createTestService();
      const orchestratorQuery = jest.fn(async () => {
        throw new RagPipelineError(
          422,
          "RAG_DOCUMENT_SCOPE_EMPTY_CONTEXT",
          "Nao encontrei trechos suficientes do documento em escopo para gerar resposta confiavel.",
        );
      });
      (service as any).orchestratorV2 = {
        query: orchestratorQuery,
      };

      const result = await service.query({
        question: "resuma esse documento",
        documentIds: [7],
      });

      expect(orchestratorQuery).toHaveBeenCalledTimes(1);
      expect(result.answer.toLowerCase()).toContain("voce quer que eu resuma o arquivo inteiro");
      expect(result.metadata.llm.model).toContain("local_intent");
      expect(llmClient.completeWithContext).not.toHaveBeenCalled();
    } finally {
      if (previousForceMode === undefined) delete process.env.RAG_PIPELINE_FORCE_MODE;
      else process.env.RAG_PIPELINE_FORCE_MODE = previousForceMode;
    }
  });

  it("aplica clamp preventivo de saida antes do orchestrator v2", async () => {
    const envBackup = {
      RAG_LLM_CONTEXT_WINDOW: process.env.RAG_LLM_CONTEXT_WINDOW,
      RAG_SAFE_OUTPUT_RATIO_PERCENT: process.env.RAG_SAFE_OUTPUT_RATIO_PERCENT,
      RAG_SAFE_INPUT_RESERVE_TOKENS: process.env.RAG_SAFE_INPUT_RESERVE_TOKENS,
      RAG_SAFE_OUTPUT_CLAMP_ENABLED: process.env.RAG_SAFE_OUTPUT_CLAMP_ENABLED,
    };
    process.env.RAG_LLM_CONTEXT_WINDOW = "2048";
    process.env.RAG_SAFE_OUTPUT_RATIO_PERCENT = "40";
    process.env.RAG_SAFE_INPUT_RESERVE_TOKENS = "1024";
    process.env.RAG_SAFE_OUTPUT_CLAMP_ENABLED = "1";

    try {
      const { service } = createTestService({ generationMaxTokens: 6000 });
      const orchestratorQuery = jest.fn(async () => ({
        answer: "ok",
        metadata: {
          resilience: {
            embeddingFailureMode: "degrade",
            degraded: false,
            degradedCode: null,
            degradedMessage: null,
            usedDocumentScopeFallback: false,
          },
          retrieval: {
            topK: 0,
            maxDistance: null,
            strategy: "hybrid_v2",
            filters: {
              documentId: null,
              documentIds: [],
              sourceType: null,
              embeddingModel: null,
            },
            returnedChunks: 0,
          },
          contextPack: {
            selectedChunks: 0,
            omittedChunks: 0,
            totalCandidateChunks: 0,
            maxChars: 0,
            usedChars: 0,
            truncated: false,
          },
          fullDocumentRead: {
            enabled: false,
            attemptedDocs: 0,
            loadedDocs: 0,
            contextDocs: 0,
            failedDocs: 0,
            fullReadChars: 0,
            includedChars: 0,
            truncatedDocs: 0,
            sources: [],
          },
          chunks: [],
          queryEmbedding: {
            model: "test",
            dimension: 0,
          },
          llm: {
            provider: "vllm_internal",
            baseUrl: "http://127.0.0.1:8000/v1",
            model: "mistral-awq",
            maxTokens: 0,
            temperature: 0,
            seed: 42,
            finishReason: "stop",
            usage: {
              promptTokens: 1,
              completionTokens: 1,
              totalTokens: 2,
            },
          },
          timingsMs: {
            embedding: 0,
            retrieval: 0,
            contextAssembly: 0,
            llm: 1,
            total: 1,
          },
          v2: {
            runId: "run",
            pipelineVersion: "v2",
            queryHash: "hash",
            traceStages: [],
            writerMode: "FAST",
            writerSections: 0,
            writerLlmCalls: 0,
            writerReinforcementCalls: 0,
            multicallLockEnabled: false,
            multicallMinWriterCalls: 0,
          },
        },
      }));
      (service as any).orchestratorV2 = {
        query: orchestratorQuery,
      };

      await service.query({
        question: "analise detalhadamente a arquitetura do sistema e proponha melhorias estruturais de alto impacto",
        maxResponseTokens: 5000,
      });

      expect(orchestratorQuery).toHaveBeenCalledTimes(1);
      const input = orchestratorQuery.mock.calls[0][0];
      expect(input.maxResponseTokens).toBe(819);
    } finally {
      if (envBackup.RAG_LLM_CONTEXT_WINDOW === undefined) delete process.env.RAG_LLM_CONTEXT_WINDOW;
      else process.env.RAG_LLM_CONTEXT_WINDOW = envBackup.RAG_LLM_CONTEXT_WINDOW;
      if (envBackup.RAG_SAFE_OUTPUT_RATIO_PERCENT === undefined) delete process.env.RAG_SAFE_OUTPUT_RATIO_PERCENT;
      else process.env.RAG_SAFE_OUTPUT_RATIO_PERCENT = envBackup.RAG_SAFE_OUTPUT_RATIO_PERCENT;
      if (envBackup.RAG_SAFE_INPUT_RESERVE_TOKENS === undefined) delete process.env.RAG_SAFE_INPUT_RESERVE_TOKENS;
      else process.env.RAG_SAFE_INPUT_RESERVE_TOKENS = envBackup.RAG_SAFE_INPUT_RESERVE_TOKENS;
      if (envBackup.RAG_SAFE_OUTPUT_CLAMP_ENABLED === undefined) delete process.env.RAG_SAFE_OUTPUT_CLAMP_ENABLED;
      else process.env.RAG_SAFE_OUTPUT_CLAMP_ENABLED = envBackup.RAG_SAFE_OUTPUT_CLAMP_ENABLED;
    }
  });

  it("usa routingHint como pergunta semantica no v2", async () => {
    const previousForceMode = process.env.RAG_PIPELINE_FORCE_MODE;
    process.env.RAG_PIPELINE_FORCE_MODE = "full";
    try {
      const { service } = createTestService();
      const orchestratorQuery = jest.fn(async () => ({
      answer: "ok",
      metadata: {
        resilience: {
          embeddingFailureMode: "degrade",
          degraded: false,
          degradedCode: null,
          degradedMessage: null,
          usedDocumentScopeFallback: false,
        },
        retrieval: {
          topK: 0,
          maxDistance: null,
          strategy: "hybrid_v2",
          filters: {
            documentId: null,
            documentIds: [],
            sourceType: null,
            embeddingModel: null,
          },
          returnedChunks: 0,
        },
        contextPack: {
          selectedChunks: 0,
          omittedChunks: 0,
          totalCandidateChunks: 0,
          maxChars: 0,
          usedChars: 0,
          truncated: false,
        },
        fullDocumentRead: {
          enabled: false,
          attemptedDocs: 0,
          loadedDocs: 0,
          contextDocs: 0,
          failedDocs: 0,
          fullReadChars: 0,
          includedChars: 0,
          truncatedDocs: 0,
          sources: [],
        },
        chunks: [],
        queryEmbedding: {
          model: "test",
          dimension: 0,
        },
        llm: {
          provider: "vllm_internal",
          baseUrl: "http://127.0.0.1:8000/v1",
          model: "mistral-awq",
          maxTokens: 0,
          temperature: 0,
          seed: 42,
          finishReason: "stop",
          usage: {
            promptTokens: 1,
            completionTokens: 1,
            totalTokens: 2,
          },
        },
        timingsMs: {
          embedding: 0,
          retrieval: 0,
          contextAssembly: 0,
          llm: 1,
          total: 1,
        },
        v2: {
          runId: "run",
          pipelineVersion: "v2",
          queryHash: "hash",
          traceStages: [],
          writerMode: "FAST",
          writerSections: 0,
          writerLlmCalls: 0,
          writerReinforcementCalls: 0,
          multicallLockEnabled: false,
          multicallMinWriterCalls: 0,
        },
      },
      }));

      (service as any).orchestratorV2 = {
        query: orchestratorQuery,
      };

      await service.query({
        question:
          "CONTRATO DE IDIOMA:\n- Responda SOMENTE em: pt-BR.\nMENSAGEM DO USUARIO:\nMe diga os pro-reitores da UFAC.\nEscreva agora a resposta final.",
        routingHint: "Me diga os pro-reitores da UFAC.",
      });

      expect(orchestratorQuery).toHaveBeenCalledTimes(1);
      const payload = orchestratorQuery.mock.calls[0][0];
      expect(payload.question).toBe("Me diga os pro-reitores da UFAC.");
    } finally {
      if (previousForceMode === undefined) delete process.env.RAG_PIPELINE_FORCE_MODE;
      else process.env.RAG_PIPELINE_FORCE_MODE = previousForceMode;
    }
  });

  it("resolve continuacao de clarificacao por nome de arquivo e retoma pergunta original", async () => {
    const previousForceMode = process.env.RAG_PIPELINE_FORCE_MODE;
    process.env.RAG_PIPELINE_FORCE_MODE = "lite";
    try {
      const { service, llmClient } = createTestService({
        vectorRows: [
          {
            id: 11,
            title: "Dissertacao sobre ensino de ciencias",
            source_path: "uploads/dissertacao-ensino.pdf",
            original_filename: "dissertacao_ensino.pdf",
          },
          {
            id: 22,
            title: "Relatorio tecnico anual",
            source_path: "uploads/relatorio-2024.pdf",
            original_filename: "relatorio_2024.pdf",
          },
        ],
      });

      const result = await service.query({
        question: "a dissertacao",
        routingHint: "a dissertacao",
        composerBound: true,
        composerAttachmentIds: [11, 22],
        history: [
          { role: "user", content: "Quero um resumo dessa obra." },
          { role: "assistant", content: "Voce pediu sobre um unico arquivo, mas ha 2 documentos no contexto. Qual deles devo usar?" },
          { role: "user", content: "a dissertacao" },
        ],
      });

      expect(result.answer).toBe("llm");
      expect(llmClient.completeWithContext).toHaveBeenCalledTimes(1);
      const payload = llmClient.completeWithContext.mock.calls[0][0];
      expect(payload.question).toBe("Quero um resumo dessa obra.");
      expect(payload.runtimeMode).toBe("lite");
    } finally {
      if (previousForceMode === undefined) delete process.env.RAG_PIPELINE_FORCE_MODE;
      else process.env.RAG_PIPELINE_FORCE_MODE = previousForceMode;
    }
  });

  it("responde saudacao durante clarificacao e pergunta se deve retomar pedido anterior", async () => {
    const previousForceMode = process.env.RAG_PIPELINE_FORCE_MODE;
    process.env.RAG_PIPELINE_FORCE_MODE = "lite";
    try {
      const { service, llmClient } = createTestService({
        vectorRows: [
          {
            id: 71,
            title: "R42 - The flipped classroom - meta analise",
            source_path: "uploads/r42-flipped-classroom.pdf",
            original_filename: "R42 - The flipped clasroom - meta....pdf",
          },
          {
            id: 72,
            title: "Stress and allostasis induced brain plasticity",
            source_path: "uploads/r59-stress-allostasis.pdf",
            original_filename: "R59---Stress-and-allostasis-induced-brain-plasticity.pdf",
          },
        ],
      });

      const result = await service.query({
        question: "boa tarde",
        routingHint: "boa tarde",
        composerBound: true,
        composerAttachmentIds: [71, 72],
        history: [
          { role: "user", content: "quero um resumo dessa obra" },
          { role: "assistant", content: "Voce pediu sobre um unico arquivo, mas ha 2 documentos no contexto. Qual deles devo usar?" },
          { role: "user", content: "a dissertacao" },
        ],
      });

      expect(result.answer.toLowerCase()).toContain("boa tarde");
      expect(result.answer.toLowerCase()).toContain("retomar seu pedido anterior");
      expect(llmClient.completeWithContext).not.toHaveBeenCalled();
    } finally {
      if (previousForceMode === undefined) delete process.env.RAG_PIPELINE_FORCE_MODE;
      else process.env.RAG_PIPELINE_FORCE_MODE = previousForceMode;
    }
  });

  it("prioriza nova solicitacao nao vinculada e nao insiste na clarificacao anterior", async () => {
    const previousForceMode = process.env.RAG_PIPELINE_FORCE_MODE;
    process.env.RAG_PIPELINE_FORCE_MODE = "lite";
    try {
      const { service, llmClient } = createTestService({
        vectorRows: [
          {
            id: 81,
            title: "R42 - The flipped classroom - meta analise",
            source_path: "uploads/r42-flipped-classroom.pdf",
            original_filename: "R42 - The flipped clasroom - meta....pdf",
          },
          {
            id: 82,
            title: "Stress and allostasis induced brain plasticity",
            source_path: "uploads/r59-stress-allostasis.pdf",
            original_filename: "R59---Stress-and-allostasis-induced-brain-plasticity.pdf",
          },
        ],
      });

      const result = await service.query({
        question: "qual e a capital do acre?",
        routingHint: "qual e a capital do acre?",
        composerBound: true,
        composerAttachmentIds: [81, 82],
        history: [
          { role: "user", content: "quero um resumo dessa obra" },
          { role: "assistant", content: "Voce pediu sobre um unico arquivo, mas ha 2 documentos no contexto. Qual deles devo usar?" },
        ],
      });

      expect(result.answer).toBe("llm");
      expect(llmClient.completeWithContext).toHaveBeenCalledTimes(1);
      expect(result.answer.toLowerCase()).not.toContain("qual deles devo usar");
    } finally {
      if (previousForceMode === undefined) delete process.env.RAG_PIPELINE_FORCE_MODE;
      else process.env.RAG_PIPELINE_FORCE_MODE = previousForceMode;
    }
  });

  it("prioriza nova solicitacao mesmo com saudacao no inicio da mensagem", async () => {
    const previousForceMode = process.env.RAG_PIPELINE_FORCE_MODE;
    process.env.RAG_PIPELINE_FORCE_MODE = "lite";
    try {
      const { service, llmClient } = createTestService({
        vectorRows: [
          {
            id: 85,
            title: "R42 - The flipped classroom - meta analise",
            source_path: "uploads/r42-flipped-classroom.pdf",
            original_filename: "R42 - The flipped clasroom - meta....pdf",
          },
          {
            id: 86,
            title: "Stress and allostasis induced brain plasticity",
            source_path: "uploads/r59-stress-allostasis.pdf",
            original_filename: "R59---Stress-and-allostasis-induced-brain-plasticity.pdf",
          },
        ],
      });

      const result = await service.query({
        question: "boa tarde, qual e a capital do acre?",
        routingHint: "boa tarde, qual e a capital do acre?",
        composerBound: true,
        composerAttachmentIds: [85, 86],
        history: [
          { role: "user", content: "quero um resumo dessa obra" },
          { role: "assistant", content: "Voce pediu sobre um unico arquivo, mas ha 2 documentos no contexto. Qual deles devo usar?" },
        ],
      });

      expect(result.answer).toBe("llm");
      expect(llmClient.completeWithContext).toHaveBeenCalledTimes(1);
      expect(result.answer.toLowerCase()).not.toContain("qual deles devo usar");
    } finally {
      if (previousForceMode === undefined) delete process.env.RAG_PIPELINE_FORCE_MODE;
      else process.env.RAG_PIPELINE_FORCE_MODE = previousForceMode;
    }
  });

  it("aceita cancelar pendencia de documento sem insistir em desambiguacao", async () => {
    const previousForceMode = process.env.RAG_PIPELINE_FORCE_MODE;
    process.env.RAG_PIPELINE_FORCE_MODE = "lite";
    try {
      const { service, llmClient } = createTestService({
        vectorRows: [
          {
            id: 91,
            title: "R42 - The flipped classroom - meta analise",
            source_path: "uploads/r42-flipped-classroom.pdf",
            original_filename: "R42 - The flipped clasroom - meta....pdf",
          },
          {
            id: 92,
            title: "Stress and allostasis induced brain plasticity",
            source_path: "uploads/r59-stress-allostasis.pdf",
            original_filename: "R59---Stress-and-allostasis-induced-brain-plasticity.pdf",
          },
        ],
      });

      const result = await service.query({
        question: "esqueca esse documento. boa tarde",
        routingHint: "esqueca esse documento. boa tarde",
        composerBound: true,
        composerAttachmentIds: [91, 92],
        history: [
          { role: "user", content: "quero um resumo dessa obra" },
          { role: "assistant", content: "Voce pediu sobre um unico arquivo, mas ha 2 documentos no contexto. Qual deles devo usar?" },
        ],
      });

      expect(result.answer.toLowerCase()).toContain("ignorar");
      expect(result.answer.toLowerCase()).not.toContain("qual deles devo usar");
      expect(llmClient.completeWithContext).not.toHaveBeenCalled();
    } finally {
      if (previousForceMode === undefined) delete process.env.RAG_PIPELINE_FORCE_MODE;
      else process.env.RAG_PIPELINE_FORCE_MODE = previousForceMode;
    }
  });

  it("resolve continuacao de clarificacao no stream e preserva a pergunta original", async () => {
    const previousForceMode = process.env.RAG_PIPELINE_FORCE_MODE;
    process.env.RAG_PIPELINE_FORCE_MODE = "lite";
    try {
      const { service, llmClient } = createTestService({
        vectorRows: [
          {
            id: 31,
            title: "Dissertacao em educacao matematica",
            source_path: "uploads/dissertacao-matematica.pdf",
            original_filename: "dissertacao_matematica.pdf",
          },
          {
            id: 32,
            title: "Plano institucional",
            source_path: "uploads/plano-institucional.pdf",
            original_filename: "plano_institucional.pdf",
          },
        ],
      });

      const stream = await service.queryStream({
        question: "a dissertacao",
        routingHint: "a dissertacao",
        composerBound: true,
        composerAttachmentIds: [31, 32],
        history: [
          { role: "user", content: "Quero um resumo dessa obra." },
          { role: "assistant", content: "Voce pediu sobre um unico arquivo, mas ha 2 documentos no contexto. Qual deles devo usar?" },
          { role: "user", content: "a dissertacao" },
        ],
      });

      const text = await readStream(stream);
      expect(text).toContain("llm");
      expect(llmClient.streamWithContext).toHaveBeenCalledTimes(1);
      const payload = llmClient.streamWithContext.mock.calls[0][0];
      expect(payload.question).toBe("Quero um resumo dessa obra.");
      expect(payload.runtimeMode).toBe("lite");
    } finally {
      if (previousForceMode === undefined) delete process.env.RAG_PIPELINE_FORCE_MODE;
      else process.env.RAG_PIPELINE_FORCE_MODE = previousForceMode;
    }
  });
});
