import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";
import { runPresentationLayer } from "../src/18-presentation-and-delivery-layer/presentation-layer-bridge";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldBuildCompletePresentationArtifacts() {
  const state = createInitialProcessingState("teste");
  state.structuredResponse = [
    "Segue um exemplo de resposta com codigo.",
    "",
    "```ts",
    "const total = 2 + 2;",
    "console.log(total);",
    "```",
  ].join("\n");
  state.retrievedSources = [
    {
      title: "Fonte oficial",
      url: "https://example.org/doc",
      snippet: "Trecho de suporte",
      freshnessScore: 0.9,
    },
    {
      title: "Memoria interna",
      url: "memory://context/1",
      snippet: "Registro interno",
      freshnessScore: 0.6,
    },
  ];
  state.confidenceScores = {
    retrieval: 0.7,
    epistemic: 0.8,
    coherence: 0.78,
    final: 0.76,
  };
  state.validationReport.quality = { score: 82, decision: "accept" };

  const result = await runPresentationLayer(state);
  assert(result.deliveryPayload.text.length > 0, "presentation payload text should not be empty");
  assert(result.deliveryPayload.citations.length === 1, "only public citations should be emitted");
  assert(result.deliveryPayload.citations[0] === "https://example.org/doc", "expected public citation to be preserved");
  assert(Boolean(result.executionArtifacts.presentation), "presentation diagnostics should be available");
  assert((result.executionArtifacts.presentation?.adapters || []).length >= 6, "all ui adapters should run");
  assert((result.executionArtifacts.presentation?.streamChunkCount || 0) > 0, "stream chunks should be generated");
}

async function shouldRespectSseChannelOverride() {
  const previousChannel = process.env.KNX_PRESENTATION_CHANNEL;
  process.env.KNX_PRESENTATION_CHANNEL = "sse";
  try {
    const state = createInitialProcessingState("oi");
    state.structuredResponse = "Resposta simples para stream.";
    const result = await runPresentationLayer(state);
    assert(result.deliveryPayload.channel === "sse", "delivery channel should follow SSE override");
    assert(/event:\s*chunk/i.test(result.deliveryPayload.text), "sse payload should include chunk events");
  } finally {
    if (typeof previousChannel === "string") process.env.KNX_PRESENTATION_CHANNEL = previousChannel;
    else delete process.env.KNX_PRESENTATION_CHANNEL;
  }
}

async function shouldNotLeakInternalEpistemicMarkers() {
  const state = createInitialProcessingState("teste");
  state.executionPlan.selectedRoute = "inferential";
  state.structuredResponse = "Resposta principal objetiva para o usuario com contexto suficiente.";
  state.epistemicAuditState = {
    claimCount: 3,
    claimKinds: {
      fact: 1,
      inference: 1,
      hypothesis: 1,
      speculation: 0,
      open_question: 0,
    },
    overclaimRisk: 0.1,
    uncertaintySignals: ["incerteza_controlada"],
    confidence: 0.82,
  };

  const result = await runPresentationLayer(state);
  assert(
    !/sinal epistemico:\s*incerteza_controlada/i.test(result.deliveryPayload.text),
    "presentation should not leak internal epistemic marker",
  );
}

async function shouldForcePortugueseWhenDetectedLanguageIsPtBr() {
  const state = createInitialProcessingState("eu não me refiro no sentido literal e biológico, mas sim num sentido de criação");
  state.language = "pt-BR";
  state.structuredResponse =
    "Based on the context you have provided multiple times, I, Letícia the AI, understand that you are not referring to it in a literal or biological sense.";

  const result = await runPresentationLayer(state);
  assert(!/based on the context/i.test(result.deliveryPayload.text), "english leak should be removed in pt-BR target");
  assert(
    /eu|não|letícia|medeiros/i.test(result.deliveryPayload.text),
    "pt-BR output should contain portuguese surface markers",
  );
}

async function shouldApplyExplicitLanguageDirectiveAfterRecognition() {
  const state = createInitialProcessingState("responda em inglês: quem criou você?");
  state.language = "pt-BR";
  state.structuredResponse = "No contexto deste projeto, Medeiros é o idealizador da Letícia.";

  const result = await runPresentationLayer(state);
  assert(
    /^i will continue in english/i.test(result.deliveryPayload.text),
    "explicit language directive should override detected language when command is explicit",
  );
}

async function shouldStripGreetingLeakInFollowUpTurns() {
  const state = createInitialProcessingState("então me explique melhor");
  state.language = "pt-BR";
  state.conversationState.turnCount = 3;
  state.recentTurns = [
    { role: "user", content: "quem te criou?" },
    { role: "assistant", content: "Medeiros idealizou a Letícia." },
  ];
  state.structuredResponse = "Olá, usuário carinho! Posso explicar melhor: Medeiros idealizou a Letícia.";

  const result = await runPresentationLayer(state);
  assert(
    !/^ol[aá],?\s*usu[aá]rio/i.test(result.deliveryPayload.text),
    "follow-up responses should not leak greeting vocative prefixes",
  );
}

async function shouldStripGreetingLeakWithoutTurnCounterWhenPromptIsNotGreeting() {
  const state = createInitialProcessingState("pode me dizer quem criou você?");
  state.language = "pt-BR";
  state.conversationState.turnCount = 0;
  state.recentTurns = [];
  state.structuredResponse = "Olá, usuário carinho! Medeiros é o idealizador da Letícia.";

  const result = await runPresentationLayer(state);
  assert(
    !/^ol[aá],?\s*usu[aá]rio/i.test(result.deliveryPayload.text),
    "non-greeting prompts must not expose greeting vocative leaks, even without turn counter",
  );
  assert(/medeiros/i.test(result.deliveryPayload.text), "semantic payload should remain preserved after sanitization");
}

async function shouldRewriteContextArtifactPhrases() {
  const state = createInitialProcessingState("quem é medeiros?");
  state.language = "pt-BR";
  state.structuredResponse = "No contexto desta IA, Medeiros é o idealizador do projeto.";

  const result = await runPresentationLayer(state);
  assert(
    !/\bno contexto desta ia\b/i.test(result.deliveryPayload.text),
    "presentation should rewrite backend-like context artifact phrases",
  );
  assert(
    /\bmedeiros\b/i.test(result.deliveryPayload.text),
    "sanitization must preserve semantic core of the answer",
  );
}

async function shouldHardBanContextoLexemeInFinalDelivery() {
  const state = createInitialProcessingState("explique de forma direta");
  state.language = "pt-BR";
  state.structuredResponse =
    "Nesse contexto, a resposta depende do contexto técnico e do contexto atual.";

  const result = await runPresentationLayer(state);
  assert(
    !/\bcontexto\b/i.test(result.deliveryPayload.text),
    "final presentation should hard-ban the lexeme 'contexto'",
  );
  assert(
    /\bcenario\b/i.test(result.deliveryPayload.text),
    "hard-ban should replace with a neutral public-safe lexeme",
  );
}

async function shouldApplyPresentationWatchdogAgainstEchoAndMixedLanguageLeak() {
  const prompt =
    "Considere um sistema social idealizado com tres principios normativos obrigatorios e analise o conflito formalmente sem repetir o enunciado.";
  const state = createInitialProcessingState(prompt);
  state.language = "pt-BR";
  state.structuredResponse = [
    "Consider a hypothetical social system with three obligatory normative principles.",
    "(1) no decisão coletiva can reduce the basic freedom of an innocent individual;",
    "(2) every decisão coletiva must maximize bem-estar agregado;",
    "(3) every decisão coletiva must be justifiable by a universal rule that can be applied sem exceção.",
    "To address the question, let's first clarify some concepts.",
  ].join(" ");

  const result = await runPresentationLayer(state);
  const answer = result.deliveryPayload.text;
  assert(!/\bconsider a hypothetical social system\b/i.test(answer), "watchdog should remove english prompt echo lead");
  assert(!/\bdecis[aã]o coletiva can\b/i.test(answer), "watchdog should remove mixed-language sentence fragments");
  assert(
    !/\bto address the question\b/i.test(answer),
    "watchdog should repair english scaffolding to target language",
  );
  assert(
    /[a-zá-ú]/i.test(answer) && /\b(responder|portugu[eê]s|direta)\b/i.test(answer),
    "watchdog output should keep portuguese surface and explicit recovery",
  );
  assert(
    result.executionArtifacts.presentation?.presentationWatchdogTriggered === true,
    "watchdog telemetry should indicate intervention",
  );
}

async function shouldStripTranscriptTailArtifactInShortIdentityReply() {
  const prompt = "pode me dizer seu nome?";
  const state = createInitialProcessingState(prompt);
  state.language = "pt-BR";
  state.structuredResponse = [
    "Sim, eu sou Letícia.",
    "Usuário: Obrigado. Agora, considere um sistema social idealizado com três princípios normativos obrigatórios.",
    "I will be happy to help you. However, before addressing your question, let me clarify some concepts.",
  ].join(" ");

  const result = await runPresentationLayer(state);
  const answer = result.deliveryPayload.text;
  const normalizedAnswer = answer
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  assert(!/\busu[aá]rio\s*:/i.test(answer), "transcript role tail should be removed");
  assert(!/\blet me clarify some concepts\b/i.test(answer), "echoed transcript tail should be removed");
  assert(
    /\bleticia\b/i.test(normalizedAnswer),
    `identity answer should remain after cleaning: ${answer}`,
  );
}

async function shouldBindLongFormDiscourseStateInDeepPresentation() {
  const state = createInitialProcessingState("analise em profundidade os trade-offs e conclua");
  state.executionPlan.selectedRoute = "inferential";
  state.deliberativeTaskState.isActive = true;
  state.generalTaskDeliberationState.isActive = true;
  state.deliberativeTaskState.obligationGraph = [
    {
      obligationId: "o1",
      label: "demonstrar conflito",
      type: "demonstration",
      priority: 100,
      dependencies: [],
      satisfactionCriteria: [],
      minimumExpectedDepth: 0.7,
    },
    {
      obligationId: "o2",
      label: "comparar modelos",
      type: "comparison",
      priority: 90,
      dependencies: [],
      satisfactionCriteria: [],
      minimumExpectedDepth: 0.6,
    },
  ];
  state.deliberativeTaskState.taskExecutionState.detectedObligations = ["demonstrar conflito", "comparar modelos"];
  state.structuredResponse = Array.from({ length: 10 })
    .map(
      () =>
        "A analise precisa manter continuidade, cobrir obrigacoes, preservar premissas e concluir com justificativa explicita.",
    )
    .join(" ");

  const result = await runPresentationLayer(state);
  assert(result.longFormDiscourseState.isActive, "deep turn should activate long-form discourse state");
  assert(
    result.executionArtifacts.presentation?.longFormUsesWorkingMemory !== undefined,
    "presentation diagnostics should expose long-form memory binding",
  );
}

async function shouldRestoreParagraphBreaksForLongStructuredAnalyticalOutput() {
  const state = createInitialProcessingState("analise em profundidade e responda item por item");
  state.executionPlan.selectedRoute = "inferential";
  state.deliberativeTaskState.isActive = true;
  state.generalTaskDeliberationState.isActive = true;
  state.structuredResponse = [
    "(a) Seja o problema definido por criterios concorrentes e restricoes de decisao. A analise precisa mostrar a estrutura do conflito em vez de apenas anuncia-la.",
    "(b) A distincao entre contradicao formal e falha de aplicacao depende de separar incompatibilidade logica de insatisfazibilidade pratica.",
    "(c) Modelo 1: usar limite de dano com otimizacao condicionada. Modelo 2: usar decisao multicriterio com revisao periodica e pesos transparentes.",
    "Conclusao: a resposta precisa fechar com sintese e nao parar no meio.",
  ].join(" ");

  const result = await runPresentationLayer(state);
  const answer = result.deliveryPayload.text;
  const paragraphCount = answer.split(/\n{2,}/g).map((item) => item.trim()).filter(Boolean).length;

  assert(paragraphCount >= 3, "presentation should restore structured analytical output into multiple paragraphs");
  assert(/\n\n\(b\)/.test(answer) || /\n\n\(c\)/.test(answer) || /\n\nConclusao:/i.test(answer), "structured analytical markers should become visible paragraph boundaries");
}

await shouldBuildCompletePresentationArtifacts();
await shouldRespectSseChannelOverride();
await shouldNotLeakInternalEpistemicMarkers();
await shouldForcePortugueseWhenDetectedLanguageIsPtBr();
await shouldApplyExplicitLanguageDirectiveAfterRecognition();
await shouldStripGreetingLeakInFollowUpTurns();
await shouldStripGreetingLeakWithoutTurnCounterWhenPromptIsNotGreeting();
await shouldRewriteContextArtifactPhrases();
await shouldHardBanContextoLexemeInFinalDelivery();
await shouldApplyPresentationWatchdogAgainstEchoAndMixedLanguageLeak();
await shouldStripTranscriptTailArtifactInShortIdentityReply();
await shouldBindLongFormDiscourseStateInDeepPresentation();
await shouldRestoreParagraphBreaksForLongStructuredAnalyticalOutput();
