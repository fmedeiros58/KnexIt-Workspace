import { createDefaultProgressSignals } from "@/core/assistant/progress/progress-signals";
import { AcademicGenre } from "@/core/assistant/genre/academic-genre.types";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { ComposeStage } from "@/core/assistant/pipeline/stages/compose.stage";
import { TemplateRegistry } from "@/core/assistant/templates/template-registry";

describe("ComposeStage", () => {
  it("inclui contrato de idioma e usa contexto consolidado", async () => {
    const template = new TemplateRegistry().getTemplate(AcademicGenre.CRITICAL_REVIEW, "pt-BR");
    let capturedQuestion = "";
    let capturedPreferredLanguage = "";
    const ragService = {
      query: async (input: { question: string; preferredResponseLanguageId?: string }) => {
        capturedQuestion = input.question;
        capturedPreferredLanguage = `${input.preferredResponseLanguageId || ""}`;
        return { answer: "ok", metadata: {} };
      },
      queryStream: async () => new ReadableStream<Uint8Array>(),
    } as any;

    const ctx: PipelineContext = {
      requestId: "req-compose",
      mode: "chat",
      stream: false,
      userMessage: "Faça uma análise crítica com base no arquivo enviado.",
      conversation: [{ role: "user", content: "Use linguagem formal e objetiva." }],
      attachments: [{ id: "15", kind: "file", name: "dissertacao.pdf" }],
      constraints: ["sem_inventar"],
      intent: { type: "analysis", confidence: 0.9 },
      ragInput: {},
      evidence: [{ source: "rag", ref: "doc:15:chunk:100", score: 0.98, text: "Trecho do documento..." }],
      processState: { scope: "analise_critica" },
      persistentPrefs: { tone: "formal" },
      language: { iso3: "por", tag: "pt-BR", confidence: 0.9 },
      genre: AcademicGenre.CRITICAL_REVIEW,
      genreConfidence: 0.9,
      templateSpec: template,
      progress: createDefaultProgressSignals(),
      plan: { sections: [{ title: "Contexto" }, { title: "Analise" }] },
    };

    const stage = new ComposeStage(ragService);
    await stage.run(ctx);

    expect(capturedQuestion).toContain("CONTRATO DE IDIOMA");
    expect(capturedQuestion).toContain("CONTRATO DE GENERO ACADEMICO");
    expect(capturedQuestion).toContain("CONTRATO DE ESPECIFICIDADE");
    expect(capturedQuestion).toContain("TEMPLATE (SECOES E REGRAS)");
    expect(capturedQuestion).toContain("CONVERSA RELEVANTE");
    expect(capturedQuestion).toContain("EVIDENCIAS");
    expect(capturedQuestion).not.toContain("You are generating");
    expect(capturedPreferredLanguage).toBe("pt-BR");
    expect(ctx.progress.composed).toBe(true);
  });

  it("compacta prompt consolidado quando ultrapassa limite configurado", async () => {
    const template = new TemplateRegistry().getTemplate(AcademicGenre.CRITICAL_REVIEW, "pt-BR");
    const previousCap = process.env.COMPOSE_PROMPT_MAX_CHARS;
    const previousConversationCap = process.env.COMPOSE_CONVERSATION_MAX_CHARS;
    const previousEvidenceCap = process.env.COMPOSE_EVIDENCE_MAX_CHARS;
    process.env.COMPOSE_PROMPT_MAX_CHARS = "1800";
    process.env.COMPOSE_CONVERSATION_MAX_CHARS = "700";
    process.env.COMPOSE_EVIDENCE_MAX_CHARS = "700";

    try {
      let capturedQuestion = "";
      const ragService = {
        query: async (input: { question: string }) => {
          capturedQuestion = input.question;
          return { answer: "ok", metadata: {} };
        },
        queryStream: async () => new ReadableStream<Uint8Array>(),
      } as any;

      const longText = "texto extenso ".repeat(1200);
      const ctx: PipelineContext = {
        requestId: "req-compose-compact",
        mode: "chat",
        stream: false,
        userMessage: "Preciso de uma analise critica objetiva.",
        conversation: [
          { role: "user", content: longText },
          { role: "assistant", content: longText },
        ],
        attachments: [{ id: "15", kind: "file", name: "dissertacao.pdf" }],
        constraints: ["sem_inventar"],
        intent: { type: "analysis", confidence: 0.9 },
        ragInput: {},
        evidence: [
          { source: "rag", ref: "doc:15:chunk:100", score: 0.98, text: longText },
          { source: "rag", ref: "doc:15:chunk:101", score: 0.97, text: longText },
        ],
        processState: { scope: "analise_critica", snapshot: longText },
        persistentPrefs: { tone: "formal", style: longText },
        language: { iso3: "por", tag: "pt-BR", confidence: 0.9 },
        genre: AcademicGenre.CRITICAL_REVIEW,
        genreConfidence: 0.9,
        templateSpec: template,
        progress: createDefaultProgressSignals(),
        plan: { sections: [{ title: "Contexto", bullets: [longText] }, { title: "Analise", bullets: [longText] }] },
      };

      const stage = new ComposeStage(ragService);
      await stage.run(ctx);

      expect(capturedQuestion.length).toBeLessThanOrEqual(1800);
      expect(capturedQuestion).toContain("MENSAGEM DO USUARIO");
      expect(capturedQuestion).toContain("CONTRATO DE IDIOMA");
    } finally {
      if (previousCap === undefined) delete process.env.COMPOSE_PROMPT_MAX_CHARS;
      else process.env.COMPOSE_PROMPT_MAX_CHARS = previousCap;
      if (previousConversationCap === undefined) delete process.env.COMPOSE_CONVERSATION_MAX_CHARS;
      else process.env.COMPOSE_CONVERSATION_MAX_CHARS = previousConversationCap;
      if (previousEvidenceCap === undefined) delete process.env.COMPOSE_EVIDENCE_MAX_CHARS;
      else process.env.COMPOSE_EVIDENCE_MAX_CHARS = previousEvidenceCap;
    }
  });
});
