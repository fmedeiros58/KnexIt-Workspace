import { createDefaultProgressSignals } from "@/core/assistant/progress/progress-signals";
import { AcademicGenre } from "@/core/assistant/genre/academic-genre.types";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { PostprocessStage } from "@/core/assistant/pipeline/stages/postprocess.stage";
import { TemplateRegistry } from "@/core/assistant/templates/template-registry";

function streamFromText(text: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) output += decoder.decode(value, { stream: true });
  }
  output += decoder.decode();
  reader.releaseLock();
  return output;
}

function makeContext(answer: string): PipelineContext {
  return {
    requestId: "req-postprocess",
    conversationKey: "test-postprocess",
    mode: "chat",
    stream: false,
    userMessage: "Faça uma analise critica.",
    conversation: [],
    constraints: [],
    intent: { type: "analysis", confidence: 0.9 },
    attachments: [],
    ragInput: {},
    evidence: [],
    processState: null,
    persistentPrefs: null,
    language: { iso3: "por", tag: "pt-BR", confidence: 0.9 },
    progress: createDefaultProgressSignals(),
    finalAnswer: answer,
  };
}

describe("PostprocessStage", () => {
  it("anexa CTA de proximo passo no padrao solicitado", async () => {
    const ctx = makeContext(
      "Este e um texto suficientemente longo para validar o pos-processamento e garantir que a resposta final mantenha coesao, profundidade e clareza em toda a argumentacao apresentada.",
    );
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer).toContain("Se quiser, no proximo passo eu posso");
    expect(ctx.progress.filteredRedundancy).toBe(true);
  });

  it("nao anexa CTA quando a restricao sem_fuga_escopo estiver ativa", async () => {
    const ctx = makeContext(
      "Este e um texto suficientemente longo para validar o pos-processamento e garantir que a resposta final mantenha coesao, profundidade e clareza em toda a argumentacao apresentada.",
    );
    ctx.constraints = ["sem_fuga_escopo"];
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer).not.toContain("Se quiser, no proximo passo eu posso");
  });

  it("aciona repair pass quando cobertura estrutural fica baixa", async () => {
    let repairCalls = 0;
    const ragService = {
      query: async () => {
        repairCalls += 1;
        return {
          answer: [
            "## Identificacao da obra",
            "Autor, titulo e contexto foram apresentados.",
            "",
            "## Sintese do conteudo",
            "A obra discute os argumentos centrais com delimitacao clara.",
            "",
            "## Tese/argumento central do autor",
            "A tese principal e apresentada de modo consistente.",
            "",
            "## Analise critica",
            "A analise relaciona evidencias, coerencia interna e limites metodologicos.",
            "",
            "## Contribuicoes e limitacoes",
            "A contribuicao principal e apontada junto das limitacoes observadas.",
            "",
            "## Dialogo com outras obras",
            "Nao informado no trecho.",
            "",
            "## Conclusao avaliativa",
            "A avaliacao final sintetiza forcas e fragilidades com criterio.",
            "",
            "## Referencias",
            "Nao informado no trecho.",
          ].join("\n"),
          metadata: {},
        };
      },
    } as any;
    const template = new TemplateRegistry().getTemplate(AcademicGenre.CRITICAL_REVIEW, "pt-BR");
    const ctx = makeContext("Texto curto sem seções suficientes para cobrir o template.");
    ctx.templateSpec = template;
    ctx.genre = AcademicGenre.CRITICAL_REVIEW;
    const stage = new PostprocessStage(ragService);
    await stage.run(ctx);
    expect(repairCalls).toBeGreaterThanOrEqual(1);
    expect(ctx.finalAnswer).toContain("## Identificacao da obra");
    expect(ctx.qualityGate?.coverageScore).toBeGreaterThanOrEqual(template.rules.minCoverage);
  });

  it("nao executa repair pass pesado quando runtime for lite em chat", async () => {
    let repairCalls = 0;
    const ragService = {
      query: async () => {
        repairCalls += 1;
        return {
          answer: "## Contexto\nResposta curta.",
          metadata: {},
        };
      },
    } as any;
    const template = new TemplateRegistry().getTemplate(AcademicGenre.CRITICAL_REVIEW, "pt-BR");
    const ctx = makeContext("Texto curto.");
    ctx.templateSpec = template;
    ctx.genre = AcademicGenre.CRITICAL_REVIEW;
    ctx.ragRuntimeMode = "lite";
    const stage = new PostprocessStage(ragService);
    await stage.run(ctx);
    expect(repairCalls).toBe(0);
  });

  it("remove eco da pergunta e prefixo 'Resposta:' no modo chat", async () => {
    const ctx = makeContext("Tudo bem?\n\n(Resposta: Sim, tudo bem.)");
    ctx.userMessage = "Tudo bem?";
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer?.toLowerCase()).toContain("sim, tudo bem");
    expect(ctx.finalAnswer).not.toMatch(/resposta\s*:/i);
    expect(ctx.finalAnswer).not.toMatch(/^Tudo bem\?/i);
  });

  it("remove sufixo parentetico de resposta duplicada", async () => {
    const ctx = makeContext("Sim, tudo bem. (Resposta em portugues brasileiro: Sim, tudo bem.)");
    ctx.userMessage = "Como voce esta?";
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer).not.toMatch(/\(\s*resposta[^)]*\)/i);
    expect(ctx.finalAnswer).not.toMatch(/resposta em portugues brasileiro\s*:/i);
  });

  it("sanitiza prefixo indevido tambem no stream de chat", async () => {
    const ctx = makeContext("");
    ctx.stream = true;
    ctx.userMessage = "Tudo bem?";
    ctx.finalStream = streamFromText("Tudo bem?\n\n(Resposta: Sim, tudo bem.)");
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalStream).toBeDefined();
    const rendered = await readStream(ctx.finalStream as ReadableStream<Uint8Array>);
    expect(rendered.toLowerCase()).toContain("sim, tudo bem");
    expect(rendered).not.toMatch(/resposta\s*:/i);
    expect(rendered).not.toMatch(/^Tudo bem\?/i);
  });

  it("sanitiza sufixo parentetico duplicado tambem no stream", async () => {
    const ctx = makeContext("");
    ctx.stream = true;
    ctx.userMessage = "Como voce esta?";
    ctx.finalStream = streamFromText("Sim, tudo bem. (Resposta em portugues brasileiro: Sim, tudo bem.)");
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalStream).toBeDefined();
    const rendered = await readStream(ctx.finalStream as ReadableStream<Uint8Array>);
    expect(rendered).toMatch(/^Sim, tudo bem\.?$/i);
    expect(rendered).not.toMatch(/\(\s*resposta[^)]*\)/i);
  });
});
