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
    const previous = process.env.ASSISTANT_APPEND_NEXT_STEP_CTA;
    process.env.ASSISTANT_APPEND_NEXT_STEP_CTA = "1";
    const ctx = makeContext(
      "Este e um texto suficientemente longo para validar o pos-processamento e garantir que a resposta final mantenha coesao, profundidade e clareza em toda a argumentacao apresentada.",
    );
    try {
      const stage = new PostprocessStage();
      await stage.run(ctx);
      expect(ctx.finalAnswer).toContain("Se quiser, no proximo passo eu posso");
      expect(ctx.progress.filteredRedundancy).toBe(true);
    } finally {
      if (typeof previous === "string") {
        process.env.ASSISTANT_APPEND_NEXT_STEP_CTA = previous;
      } else {
        delete process.env.ASSISTANT_APPEND_NEXT_STEP_CTA;
      }
    }
  });

  it("nao anexa CTA quando a restricao sem_fuga_escopo estiver ativa", async () => {
    const previous = process.env.ASSISTANT_APPEND_NEXT_STEP_CTA;
    process.env.ASSISTANT_APPEND_NEXT_STEP_CTA = "1";
    const ctx = makeContext(
      "Este e um texto suficientemente longo para validar o pos-processamento e garantir que a resposta final mantenha coesao, profundidade e clareza em toda a argumentacao apresentada.",
    );
    ctx.constraints = ["sem_fuga_escopo"];
    try {
      const stage = new PostprocessStage();
      await stage.run(ctx);
      expect(ctx.finalAnswer).not.toContain("Se quiser, no proximo passo eu posso");
    } finally {
      if (typeof previous === "string") {
        process.env.ASSISTANT_APPEND_NEXT_STEP_CTA = previous;
      } else {
        delete process.env.ASSISTANT_APPEND_NEXT_STEP_CTA;
      }
    }
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

  it("remove prefixo de persona e saudacao excessiva em pergunta factual verificavel", async () => {
    const ctx = makeContext("Leticia: Ola, usuario. Atualmente, o presidente dos Estados Unidos e Joe Biden.");
    ctx.userMessage = "me diga quem e o presidente atual dos estados unidos";
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").not.toMatch(/^leticia\s*:/i);
    expect(ctx.finalAnswer || "").not.toMatch(/^ol[aá],?\s*usuario/i);
  });

  it("bloqueia resposta factual sem evidencia web em pergunta verificavel", async () => {
    const ctx = makeContext("Atualmente, o presidente do Brasil e Jair Bolsonaro.");
    ctx.userMessage = "quem e o presidente do brasil atualmente?";
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").toContain("Nao consegui validar esse fato em fontes web neste turno");
    expect(ctx.finalAnswer || "").not.toContain("Jair Bolsonaro");
  });

  it("mantem resposta verificavel quando ha evidencia web positiva", async () => {
    const ctx = makeContext("Atualmente, o presidente do Brasil e Luiz Inacio Lula da Silva.");
    ctx.userMessage = "quem e o presidente do brasil atualmente?";
    ctx.evidence = [
      {
        source: "rag",
        ref: "web:1",
        score: 0.81,
        text: "[WEB] Governo Federal | URL: https://www.gov.br",
      },
    ];
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").toContain("Luiz Inacio Lula da Silva");
  });

  it("bloqueia referencia autor-ano sem lastro documental ou web", async () => {
    const ctx = makeContext(
      "Medeiros (2025) define Responsividade Plastica Cerebral em quatro eixos e comprova eficacia em larga escala.",
    );
    ctx.userMessage = "faca uma resenha critica da obra de Medeiros (2025)";
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").toContain(
      "Nao consegui validar esta referencia autor-ano com fontes ancoradas neste turno",
    );
    expect(ctx.finalAnswer || "").not.toContain("quatro eixos");
  });

  it("mantem resposta autor-ano quando ha escopo de documento anexado", async () => {
    const ctx = makeContext("Com base no documento anexado, Medeiros (2025) organiza a argumentacao em tres blocos.");
    ctx.userMessage = "faca uma resenha critica da obra de Medeiros (2025)";
    ctx.ragInput = { documentId: 15 };
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").toContain("Medeiros (2025)");
    expect(ctx.finalAnswer || "").not.toContain(
      "Nao consegui validar esta referencia autor-ano com fontes ancoradas neste turno",
    );
  });

  it("solicita clarificacao quando ha escopo documental sem evidencia ancorada para analise da obra", async () => {
    const ctx = makeContext(
      "Uma analise critica e uma avaliacao objetiva de um trabalho, considerando estrutura, coesao, clareza e originalidade.",
    );
    ctx.userMessage = "faca uma resenha critica desse arquivo";
    ctx.ragInput = { composerBound: true, documentIds: [44] };
    ctx.evidence = [
      { source: "file", ref: "44", score: 1, text: "R60 - Dissertacao Medeiros - Final.pdf" },
      { source: "memory", ref: "docscope:44:missing", score: 0.2, text: "Nao foi possivel recuperar trechos." },
    ];
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").toContain("Posso fazer essa analise, mas ainda nao tenho trechos suficientes");
    expect(ctx.finalAnswer || "").toContain("indicar paginas/trechos prioritarios");
  });

  it("aplica a mesma clarificacao no stream quando faltar evidencia documental ancorada", async () => {
    const ctx = makeContext("");
    ctx.stream = true;
    ctx.userMessage = "faca uma resenha critica desse arquivo";
    ctx.ragInput = { composerBound: true, documentIds: [44] };
    ctx.evidence = [
      { source: "file", ref: "44", score: 1, text: "R60 - Dissertacao Medeiros - Final.pdf" },
      { source: "memory", ref: "docscope:44:error", score: 0.2, text: "Nao foi possivel consultar o conteudo." },
    ];
    ctx.finalStream = streamFromText(
      "Uma analise critica e uma avaliacao objetiva de um trabalho. Sem contexto especifico, essa e uma analise geral.",
    );
    const stage = new PostprocessStage();
    await stage.run(ctx);
    const rendered = await readStream(ctx.finalStream as ReadableStream<Uint8Array>);
    expect(rendered).toContain("Posso fazer essa analise, mas ainda nao tenho trechos suficientes");
    expect(rendered).toContain("indicar paginas/trechos prioritarios");
  });

  it("solicita dados faltantes em pedido de texto convite com nome incompleto (caso reportado)", async () => {
    const ctx = makeContext(
      'Claro, aqui esta um texto convite: "Meu nome completo e [nome], tenho [idade] anos e trabalho como [profissao]."',
    );
    ctx.userMessage =
      "eu quero que vc escreva u texto convite de 15 linhas para enviar para um amigo. contendo o meu nome completo, minha idade, e minha profissao. meu nome e medeiros.";
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").toContain("ainda preciso de seu nome completo, sua idade, sua profissao");
    expect(ctx.finalAnswer || "").toContain("nome do seu amigo");
    expect(ctx.finalAnswer || "").not.toContain("[idade]");
  });

  it("aplica a mesma regra em stream para pedido de convite com dados faltantes", async () => {
    const ctx = makeContext("");
    ctx.stream = true;
    ctx.userMessage =
      "eu quero que vc escreva u texto convite de 15 linhas para enviar para um amigo. contendo o meu nome completo, minha idade, e minha profissao. meu nome e medeiros.";
    ctx.finalStream = streamFromText(
      "Posso montar o convite. Meu nome completo e [nome], tenho [idade] anos e minha profissao e [profissao].",
    );
    const stage = new PostprocessStage();
    await stage.run(ctx);
    const rendered = await readStream(ctx.finalStream as ReadableStream<Uint8Array>);
    expect(rendered).toContain("ainda preciso de seu nome completo, sua idade, sua profissao");
    expect(rendered).toContain("nome do seu amigo");
    expect(rendered).not.toContain("[idade]");
  });

  it("bloqueia vazamento de diretiva/persona em pergunta verificavel", async () => {
    const ctx = makeContext(
      "I'm an assistant inside KnexIT, responding professionally and objectively. I won't reveal internal processes.",
    );
    ctx.userMessage = "quem e o presidente do brasil atualmente?";
    ctx.evidence = [
      {
        source: "rag",
        ref: "web:1",
        score: 0.72,
        text: "[WEB] Fonte valida | URL: https://exemplo.org",
      },
    ];
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").toContain("Nao consegui validar esse fato em fontes web neste turno");
    expect(ctx.finalAnswer || "").not.toContain("inside KnexIT");
  });

  it("bloqueia vazamento de meta-resposta do assistente interno em pergunta verificavel", async () => {
    const ctx = makeContext(
      "Ola, sou o assistente interno da plataforma KnexIT. Nao sou Leticia e nao exponho processos internos.",
    );
    ctx.userMessage = "quem e o presidente do brasil atualmente?";
    ctx.evidence = [
      {
        source: "rag",
        ref: "web:1",
        score: 0.72,
        text: "[WEB] Fonte valida | URL: https://exemplo.org",
      },
    ];
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").toContain("Nao consegui validar esse fato em fontes web neste turno");
    expect(ctx.finalAnswer || "").not.toContain("assistente interno");
  });

  it("bloqueia vazamento de diretiva/persona no stream para pergunta verificavel", async () => {
    const ctx = makeContext("");
    ctx.stream = true;
    ctx.userMessage = "quem e o presidente do brasil atualmente?";
    ctx.evidence = [
      {
        source: "rag",
        ref: "web:1",
        score: 0.72,
        text: "[WEB] Fonte valida | URL: https://exemplo.org",
      },
    ];
    ctx.finalStream = streamFromText(
      "I'm an assistant inside KnexIT, responding professionally and objectively. I won't reveal internal processes.",
    );
    const stage = new PostprocessStage();
    await stage.run(ctx);
    const rendered = await readStream(ctx.finalStream as ReadableStream<Uint8Array>);
    expect(rendered).toContain("Nao consegui validar esse fato em fontes web neste turno");
    expect(rendered).not.toContain("inside KnexIT");
  });

  it("remove artefatos de mantra factual e marcador de fim", async () => {
    const ctx = makeContext(
      [
        "Titular atual verificado: Donald Trump.",
        "Confianca: alta.",
        "Verificado em: 2026-03-12.",
        "[end of response]",
      ].join("\n"),
    );
    ctx.userMessage = "quem e o presidente dos estados unidos atualmente?";
    ctx.evidence = [
      {
        source: "rag",
        ref: "web:1",
        score: 0.81,
        text: "[WEB] White House | URL: https://www.whitehouse.gov/",
      },
    ];
    const stage = new PostprocessStage();
    await stage.run(ctx);
    expect(ctx.finalAnswer || "").toContain("Titular atual verificado: Donald Trump.");
    expect(ctx.finalAnswer || "").not.toContain("Confianca:");
    expect(ctx.finalAnswer || "").not.toContain("Verificado em:");
    expect(ctx.finalAnswer || "").not.toContain("[end of response]");
  });
});
