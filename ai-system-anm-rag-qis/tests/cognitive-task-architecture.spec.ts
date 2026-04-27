/**
 * @file cognitive-task-architecture.spec.ts
 * @description Cobre classificação cognitiva, seleção de perfis, validação, auditabilidade, continuidade dialógica e entrega terminal.
 * @layer tests
 * @purpose Garantir que o núcleo de adequação cognitiva e a entrega final preservem respostas completas e coerentes.
 * @inputs Entradas sintéticas de tarefa, contratos, estados de processamento e streams truncados.
 * @outputs Asserções automatizadas sobre contratos, perfis, validadores, auditoria e serialização.
 * @dependsOn Camadas 03, 04, 05, 05b, 10, 17, 18 e 19 do pipeline descendente.
 * @usedBy Runner de testes Node/tsx do repositório ai-system-anm-rag-qis.
 * @invariants A arquitetura deve continuar descendente e o texto final não deve ser cortado pelo canal de entrega.
 * @notes Inclui regressões para perguntas de lógica fechada e streams SSE/WebSocket truncados.
 */
import { classifyTaskNature } from "../src/05-complexity-and-orchestration-layer/task-nature-classifier";
import { selectExecutionProfileIds } from "../src/05-complexity-and-orchestration-layer/execution-profiles/profile-selector";
import { buildLayerActivationMatrix } from "../src/05-complexity-and-orchestration-layer/activation-policy/layer-activation-matrix";
import { executionProfileCatalogById } from "../src/05-complexity-and-orchestration-layer/execution-profiles/profile-catalog";
import { buildTaskContract } from "../src/05b-deliberative-task-contract-layer/task-contract-builder";
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";
import { buildPipelineAuditReport } from "../src/19-observability-control-and-admin-layer/architectural-audit/pipeline-audit-report-builder";
import { checkConstraintCompliance } from "../src/17-validation-layer/operators/constraint-compliance-checker";
import { checkSolutionCompleteness } from "../src/17-validation-layer/operators/solution-completeness-checker";
import { validateTaskModeFit } from "../src/17-validation-layer/operators/task-mode-fit-validator";
import { detectYesMan } from "../src/17-validation-layer/operators/yes-man-detector";
import { detectContrarianOverreach } from "../src/17-validation-layer/operators/contrarian-overreach-detector";
import { validateResponseFormatFit } from "../src/17-validation-layer/operators/response-format-fit-validator";
import { challengeFirstAnswer } from "../src/10-reflective-layer/operators/first-answer-challenge";
import { updateDialogueState } from "../src/04-context-and-session-layer/operators/dialogue-state-updater";
import { trackOpenLoops } from "../src/04-context-and-session-layer/operators/open-loop-tracker";
import { updateCommitmentLedger } from "../src/04-context-and-session-layer/operators/commitment-ledger-updater";
import { sseDelivery } from "../src/18-presentation-and-delivery-layer/front-delivery-layer/sse-delivery";
import { websocketDelivery } from "../src/18-presentation-and-delivery-layer/front-delivery-layer/websocket-delivery";
import {
  buildPresentationFrontDelivery,
  handoffPresentationToFront,
} from "../src/18-presentation-and-delivery-layer/presentation-front-bridge";
import { buildPresentationStream } from "../src/18-presentation-and-delivery-layer/presentation-stream-bridge";
import { buildTaskPrompt } from "../src/14-reasoning-and-generation-layer/prompt-construction-core/task-prompt-builder";
import { runGenerationLayer } from "../src/14-reasoning-and-generation-layer/generation-layer-bridge";
import { solveClosedConstraintDeduction } from "../src/11-inferential-layer/operators/closed-constraint-solver";
import { runPipelineConductor } from "../src/00-myelinated-pipeline-core/pipeline-conductor";
import type { FusedRoutingDecision } from "../src/05-complexity-and-orchestration-layer/llm-routing/routing-analysis-types";
import type { ProfileSelectionResult } from "../src/bridges/contracts/profile-selection-result";

function makeFusedDecision(overrides: Partial<FusedRoutingDecision> = {}): FusedRoutingDecision {
  return {
    primaryIntent: "analysis",
    secondaryIntents: [],
    finalComplexityScore: 0.62,
    finalComplexityBand: "medium",
    complexityConfidence: 0.8,
    ambiguityScore: 0.2,
    taskType: "analysis",
    domainProfile: { primary: "general", secondary: [] },
    topicShift: false,
    memoryNeed: "light",
    retrievalNeed: "light",
    validationNeed: "standard",
    reflectionNeed: "light",
    responseStyle: "structured",
    expectedOutputShape: ["structured-answer"],
    recommendedProfiles: [],
    profileWeights: {},
    riskLevel: "low",
    needsClarification: false,
    proactivityTolerance: "low",
    estimatedBudgetClass: "standard",
    selectedMode: "analysis",
    routeHint: "inferential",
    usedMotor: false,
    fallbackUsed: false,
    dominantSignals: [],
    motorRoutingAnalysis: {
      source: "heuristic-fallback",
      primaryIntent: "analysis",
      secondaryIntents: [],
      complexityBand: "medium",
      complexityConfidence: 0.8,
      ambiguityScore: 0.2,
      taskType: "analysis",
      domainProfile: { primary: "general", secondary: [] },
      topicShift: false,
      memoryNeed: "light",
      retrievalNeed: "light",
      validationNeed: "standard",
      reflectionNeed: "light",
      responseStyle: "structured",
      expectedOutputShape: ["structured-answer"],
      recommendedProfiles: [],
      profileWeights: {},
      riskLevel: "low",
      needsClarification: false,
      proactivityTolerance: "low",
      estimatedBudgetClass: "standard",
      schemaValid: true,
      normalized: true,
      fallbackUsed: false,
      cacheHit: false,
      timeoutMs: 0,
      errors: [],
    },
    ...overrides,
  };
}

function makeProfileSelection(ids: string[]): ProfileSelectionResult {
  return {
    primaryProfileId: ids[0],
    selectedProfileIds: ids,
    weights: Object.fromEntries(ids.map((id, index) => [id, Number((1 - index * 0.1).toFixed(2))])),
    reasons: ["test"],
    dominantSignals: ["test_signal"],
    catalogVersion: "test",
  };
}

describe("cognitive task architecture", () => {
  test("classifies core cognitive task natures separately from intent", () => {
    const samples = [
      ["oi", "greeting_light"],
      ["me conta algo em modo conversa leve", "conversational_light"],
      ["explique didaticamente como funciona uma pilha", "pedagogical_explanation"],
      ["analise tecnicamente esse pipeline TypeScript", "technical_analysis"],
      ["contra-argumente esta tese", "dialectical_counterargument"],
      ["tenho 3 caixas, todas as etiquetas estao erradas e posso tirar apenas 1 fruta", "closed_constraint_deduction"],
      ["me de instrucoes para configurar o servico", "procedural_instruction"],
      ["corrija a falha de stream truncado", "debug_and_correction"],
      ["verifique nas fontes recentes e cite evidencias", "retrieval_grounded_analysis"],
    ] as const;

    for (const [message, expected] of samples) {
      const state = classifyTaskNature({ normalizedMessage: message, conversationalIntent: "ask" });
      expect(state.selectedTaskType).toBe(expected);
      expect(state.conversationalIntents).toContain("ask");
    }
  });

  test("selects coherent primary profile and activation matrix", () => {
    const taskNature = classifyTaskNature({
      normalizedMessage: "resolva com apenas uma observacao e todas as etiquetas erradas",
      conversationalIntent: "ask",
    });
    const profileIds = selectExecutionProfileIds({
      normalizedMessage: "resolva com apenas uma observacao e todas as etiquetas erradas",
      fusedDecision: makeFusedDecision(),
      taskNatureState: taskNature,
    });

    expect(profileIds[0]).toBe("closed-constraint-deduction-profile");
    const profiles = profileIds.map((id) => executionProfileCatalogById[id]);
    const activations = buildLayerActivationMatrix(profiles, makeProfileSelection(profileIds).weights);
    const deliberativeActivation = activations["deliberative-task-contract"];
    expect(deliberativeActivation?.mode).toBe("heavy");
    expect(activations.validation?.mode).toBe("heavy");
  });

  test("validates class-specific violations and self critique", () => {
    const state = createInitialProcessingState("apenas uma fruta; todas as etiquetas estao erradas");
    const taskNature = classifyTaskNature({ normalizedMessage: state.normalizedMessage, conversationalIntent: "ask" });
    const contract = buildTaskContract({
      state,
      taskNatureState: taskNature,
      profileSelection: makeProfileSelection(["closed-constraint-deduction-profile"]),
      responseBudget: 512,
      riskLevel: "low",
    });
    const genericAnswer = "Voce pode tentar testar as hipoteses em seguida nas outras caixas para eliminar combinacoes possiveis.";
    const arbitraryAnswer = "Escolha uma caixa aleatoria, tire uma fruta e depois repita o teste em outra caixa.";

    expect(contract.logicalAdequacy?.actionBudget.maxObservations).toBe(1);
    expect(contract.logicalAdequacy?.requiresPivotSelection).toBe(true);
    expect(contract.prohibitedActions).toContain("iterative_exploration");
    expect(contract.prohibitedActions).toContain("random_choice");
    expect(checkConstraintCompliance(genericAnswer, contract).length).toBeGreaterThan(0);
    expect(checkConstraintCompliance(arbitraryAnswer, contract).length).toBeGreaterThan(1);
    expect(checkSolutionCompleteness("Voce pode tentar testar hipoteses.", contract).length).toBeGreaterThan(0);
    expect(validateTaskModeFit(genericAnswer.repeat(20), contract).length).toBeGreaterThan(0);
    expect(validateTaskModeFit(arbitraryAnswer, contract).length).toBeGreaterThan(0);
    expect(validateResponseFormatFit(genericAnswer, contract).length).toBeGreaterThan(0);
    expect(challengeFirstAnswer(genericAnswer, contract).shouldRevise).toBe(true);
    expect(challengeFirstAnswer(arbitraryAnswer, contract).findings).toContain("faltou_identificar_passo_pivo_informativo");

    const dialectical = { ...contract, cognitiveTaskType: "dialectical_counterargument" as const, needsCounterposition: true };
    expect(detectYesMan("Sim, concordo totalmente.", dialectical).length).toBeGreaterThan(0);
    expect(detectContrarianOverreach("Discordo totalmente. Isso esta errado. Falso.", dialectical).length).toBeGreaterThan(0);
  });

  test("injects closed deduction task contract directives into generation prompt", () => {
    const state = createInitialProcessingState("tenho 3 caixas, etiquetas erradas e posso tirar apenas 1 fruta");
    const taskNature = classifyTaskNature({ normalizedMessage: state.normalizedMessage, conversationalIntent: "ask" });
    state.taskNatureState = taskNature;
    state.taskContract = buildTaskContract({
      state,
      taskNatureState: taskNature,
      profileSelection: makeProfileSelection(["closed-constraint-deduction-profile"]),
      responseBudget: 512,
      riskLevel: "low",
    });

    const prompt = buildTaskPrompt(state);
    expect(prompt).toContain("Resolva a deducao fechada");
    expect(prompt).toContain("Identifique o passo-pivo");
    expect(prompt).toContain("Nao proponha experimentos adicionais");
  });

  test("solves finite all-labels-wrong deduction without hardcoding the fruit puzzle", () => {
    const result = solveClosedConstraintDeduction({
      prompt: [
        "Tres caixas com etiquetas:",
        "Azuis",
        "Vermelhas",
        "Azuis e Vermelhas",
        "Todas as etiquetas estao erradas.",
        "Voce pode tirar apenas 1 item de 1 unica caixa.",
      ].join("\n"),
    });

    expect(result.recognized).toBe(true);
    expect(result.action).toContain("Azuis e Vermelhas");
    expect(result.conclusions.join(" ")).toContain("Se sair \"Azuis\"");
    expect(result.conclusions.join(" ")).toContain("Se sair \"Vermelhas\"");
  });

  test("recognizes closed deduction even when input has replacement-style encoding damage", () => {
    const result = solveClosedConstraintDeduction({
      prompt: [
        "Tres caixas com etiquetas:",
        "Ma??s",
        "Laranjas",
        "Ma??s e Laranjas",
        "Todas as etiquetas est?o erradas.",
        "Voce pode tirar apenas 1 item de 1 unica caixa.",
      ].join("\n"),
    });

    expect(result.recognized).toBe(true);
    expect(result.action).toContain("Ma??s e Laranjas");
    expect(result.issues).toEqual([]);
  });

  test("does not flag valid elimination-only deduction as extra observation", () => {
    const state = createInitialProcessingState("apenas uma fruta; todas as etiquetas estao erradas");
    const taskNature = classifyTaskNature({ normalizedMessage: state.normalizedMessage, conversationalIntent: "ask" });
    const contract = buildTaskContract({
      state,
      taskNatureState: taskNature,
      profileSelection: makeProfileSelection(["closed-constraint-deduction-profile"]),
      responseBudget: 512,
      riskLevel: "low",
    });
    const answer = [
      "Retire a unica amostra permitida da caixa rotulada \"Macas e Laranjas\".",
      "Depois disso, as duas caixas restantes sao determinadas por eliminacao e pela regra de que seus rotulos tambem estao errados.",
      "Se sair \"Macas\", a caixa \"Macas e Laranjas\" contem apenas \"Macas\".",
      "Se sair \"Laranjas\", a caixa \"Macas e Laranjas\" contem apenas \"Laranjas\".",
    ].join(" ");

    expect(checkConstraintCompliance(answer, contract)).toEqual([]);
    expect(challengeFirstAnswer(answer, contract).shouldRevise).toBe(false);
  });

  test("generation uses closed-constraint solver before LLM for recognized single-observation tasks", async () => {
    const prompt = [
      "Tres caixas com etiquetas:",
      "Macas",
      "Laranjas",
      "Macas e Laranjas",
      "Todas as etiquetas estao erradas.",
      "Voce pode tirar apenas 1 fruta de 1 unica caixa.",
      "Como descobrir corretamente o conteudo de todas as caixas?",
    ].join("\n");
    const state = createInitialProcessingState(prompt);
    const taskNature = classifyTaskNature({ normalizedMessage: state.normalizedMessage, conversationalIntent: "ask" });
    state.taskNatureState = taskNature;
    state.taskContract = buildTaskContract({
      state,
      taskNatureState: taskNature,
      profileSelection: makeProfileSelection(["closed-constraint-deduction-profile"]),
      responseBudget: 512,
      riskLevel: "low",
    });

    await runGenerationLayer(state);

    expect(state.draftResponse.text).toContain("Macas e Laranjas");
    expect(state.draftResponse.text).toContain("unica amostra permitida");
    expect(state.draftResponse.text).not.toContain("caixa aleatoria");
    expect(state.draftResponse.text).not.toContain("repita");
    expect(state.trace.some((event) => event.action === "closed_constraint_solver_direct_generated")).toBe(true);
  });

  test("end-to-end pipeline preserves deterministic closed deduction through presentation", async () => {
    const prompt = [
      "Voce tem 3 caixas com etiquetas:",
      "Ma\u00E7\u00E3s",
      "Laranjas",
      "Ma\u00E7\u00E3s e Laranjas",
      "",
      "Mas sabe que todas as etiquetas est\u00E3o erradas.",
      "Voce pode tirar apenas 1 fruta de 1 unica caixa, sem olhar dentro das outras.",
      "Como descobrir corretamente o conteudo de todas as 3 caixas?",
    ].join("\n");

    const result = await runPipelineConductor({ rawMessage: prompt });
    const delivered = `${result.responseText || ""}`;

    expect(result.state.executionArtifacts.inferential?.closedConstraintSolver?.recognized).toBe(true);
    expect(result.state.executionArtifacts.generationRuntime?.used === true).toBe(false);
    expect(result.state.validationReport.quality.decision).toBe("accept");
    expect(result.state.deliveryPayload.citations).toEqual([]);
    expect(delivered).toContain("Ma\u00E7\u00E3s e Laranjas");
    expect(delivered).toContain("Se sair \"Ma\u00E7\u00E3s\"");
    expect(delivered).toContain("Se sair \"Laranjas\"");
    expect(/\b(?:repita|aleatoria|Fontes|Usu[a\u00E1]rio:|Let[i\u00ED]cia)/i.test(delivered)).toBe(false);
  });

  test("generation recovers closed-constraint solver from recent context on logical follow-up", async () => {
    const state = createInitialProcessingState("Mas ainda nao estou entendendo como isso resolve sem olhar nas outras caixas.");
    state.recentTurns = [
      {
        role: "user",
        content: [
          "Tres caixas com etiquetas:",
          "Macas",
          "Laranjas",
          "Macas e Laranjas",
          "Todas as etiquetas estao erradas.",
          "Voce pode tirar apenas 1 fruta de 1 unica caixa.",
        ].join("\n"),
      },
      {
        role: "assistant",
        content: "Resposta anterior incorreta com caixa aleatoria e repeticao.",
      },
    ];

    await runGenerationLayer(state);

    expect(state.draftResponse.text).toContain("Macas e Laranjas");
    expect(state.draftResponse.text).toContain("nao pode conter a mistura");
    expect(state.draftResponse.text).not.toContain("caixa aleatoria");
    expect(state.trace.some((event) => event.action === "closed_constraint_solver_direct_generated")).toBe(true);
  });

  test("builds audit report with task type, profile, activation map and validators", () => {
    const state = createInitialProcessingState("corrija a falha de stream truncado");
    const taskNature = classifyTaskNature({ normalizedMessage: state.normalizedMessage, conversationalIntent: "debug" });
    const profileIds = ["technical-analysis-profile", "debug-correction-profile"];
    state.taskNatureState = taskNature;
    state.profileSelectionResult = makeProfileSelection(profileIds);
    state.taskContract = buildTaskContract({
      state,
      taskNatureState: taskNature,
      profileSelection: state.profileSelectionResult,
      responseBudget: 900,
      riskLevel: "medium",
    });
    state.adaptivePipelineContract = {
      version: "test",
      primaryIntent: "analysis",
      secondaryIntents: [],
      taskNatureState: state.taskNatureState,
      taskContract: state.taskContract,
      finalComplexityScore: 0.7,
      finalComplexityBand: "high",
      complexityConfidence: 0.8,
      ambiguityScore: 0.1,
      selectedProfiles: state.profileSelectionResult,
      layerActivations: buildLayerActivationMatrix(profileIds.map((id) => executionProfileCatalogById[id]), state.profileSelectionResult.weights),
      memoryPolicy: "light",
      retrievalPolicy: "light",
      reflectionPolicy: "standard",
      validationPolicy: "heavy",
      responsePolicy: "structured",
      proactivityPolicy: "low",
      humanizationPolicy: "minimal",
      responseBudget: 900,
      budgetClass: "standard",
      riskLevel: "medium",
      needsClarification: false,
      topicShift: false,
      expectedOutputShape: ["structured-answer"],
      fallbackEvidence: [],
      decisionTrace: [],
      motorRoutingAnalysis: makeFusedDecision().motorRoutingAnalysis,
    };
    state.executionArtifacts.validation = {
      activeValidationFamilies: ["validation_task_class"],
      validationProfile: "strict",
      validationStage: "pre_presentation",
      validatorsTriggered: ["task-mode-fit-validator"],
      selfCritiqueFindings: ["ok"],
    };

    const report = buildPipelineAuditReport(state);
    expect(report.selectedTaskType).toBe("debug_and_correction");
    expect(report.selectedProfile).toBe("technical-analysis-profile");
    expect(Object.keys(report.layerActivationMap).length).toBeGreaterThan(0);
    expect(report.validatorsTriggered).toContain("task-mode-fit-validator");
    expect(report.selfCritique?.findings || ["ok"]).toContain("ok");
  });

  test("tracks dialogue continuity, open loops and commitments", () => {
    const loops = trackOpenLoops("voce pode verificar isso?");
    const dialogue = updateDialogueState({
      activeTopic: "stream truncado",
      topicShiftDetected: false,
      openLoops: loops,
      userStance: "challenging",
    });
    const ledger = updateCommitmentLedger(null, "user", "o stream esta cortando antes do fim");

    expect(dialogue.openLoops.length).toBeGreaterThan(0);
    expect(dialogue.dialogicalTension).toBe("medium");
    expect(ledger.unresolvedCount).toBe(1);
  });

  test("appends corrective terminal delivery event when reused stream is truncated", () => {
    const retryPolicy = { maxAttempts: 1, baseBackoffMs: 200, jitterMs: 0 };
    const fullText = "Resposta final completa sem corte.";
    const truncatedSse = [
      "event: chunk",
      `data: ${JSON.stringify({ index: 0, delta: "Resposta final com", cumulativeText: "Resposta final com", done: false })}`,
      "",
      "event: done",
      `data: ${JSON.stringify({ done: true, text: "Resposta final com" })}`,
      "",
    ].join("\n");
    const sse = sseDelivery({
      serializedText: fullText,
      stream: { ok: true, component: "stream-chunk-serializer", score: 1, text: truncatedSse, chunkCount: 1 },
      retryPolicy,
    });
    expect(sse.text).toContain(fullText);

    const truncatedWs = JSON.stringify({ type: "done", text: "Resposta final com", done: true });
    const ws = websocketDelivery({
      serializedText: fullText,
      stream: { ok: true, component: "stream-chunk-serializer", score: 1, text: truncatedWs, chunkCount: 1 },
      retryPolicy,
    });
    expect(ws.text).toContain(fullText);
  });

  test("handoff keeps semantic final text separate from reused SSE stream text", () => {
    const fullText = "A caixa rotulada como Maçãs e Laranjas deve ser testada primeiro.";
    const truncatedText = "A caixa rotulada como Maçãs";
    const truncatedSse = [
      "event: chunk",
      `data: ${JSON.stringify({ index: 0, delta: truncatedText, cumulativeText: truncatedText, done: false })}`,
      "",
      "event: done",
      `data: ${JSON.stringify({ done: true, text: truncatedText })}`,
      "",
    ].join("\n");
    const state = createInitialProcessingState("pergunta de logica");
    state.deliveryPayload = {
      channel: "sse",
      text: truncatedSse,
      serialized: { format: "plain-text", text: fullText, payload: { text: fullText }, score: 0.9 },
      stream: { ok: true, component: "stream-chunk-serializer", score: 0.9, text: truncatedSse, chunkCount: 1 },
      citations: [],
    } as any;

    handoffPresentationToFront(state);
    const delivered = `${(state.deliveryPayload as any).text || ""}`;
    const integrity = (state.deliveryPayload as any).payload?.finalDeliveryIntegrity;
    const doneEvents = delivered
      .split(/\n\n/g)
      .filter((block) => /event:\s*done/i.test(block));

    expect(delivered).toContain(fullText);
    expect(doneEvents[doneEvents.length - 1]).toContain(fullText);
    expect(integrity.terminalMatchesSemanticText).toBe(true);
    expect(integrity.correctiveTerminalLikelyAppended).toBe(true);
    expect(integrity.doneEventCount).toBeGreaterThan(1);
  });

  test("handoff strips leaked transcript and persona markers before front delivery", () => {
    const cleanHead = "Retire uma fruta da caixa rotulada como Macas e Laranjas.";
    const leaked = `${cleanHead} Usuario: obrigado pela resposta. Usuario: pode responder de outra forma? LeticiaSim, repetindo historico.`;
    const leakedSse = [
      "event: chunk",
      `data: ${JSON.stringify({ index: 0, delta: leaked, cumulativeText: leaked, done: false })}`,
      "",
      "event: done",
      `data: ${JSON.stringify({ done: true, text: leaked })}`,
      "",
    ].join("\n");
    const state = createInitialProcessingState("pergunta de logica");
    state.deliveryPayload = {
      channel: "sse",
      text: leakedSse,
      serialized: { format: "plain-text", text: leaked, payload: { text: leaked }, score: 0.9 },
      stream: { ok: true, component: "stream-chunk-serializer", score: 0.9, text: leakedSse, chunkCount: 1 },
      citations: [],
    } as any;

    handoffPresentationToFront(state);
    const delivered = `${(state.deliveryPayload as any).text || ""}`;
    const payloadText = `${(state.deliveryPayload as any).payload?.text || ""}`;

    expect(payloadText).toBe(cleanHead);
    expect(delivered).toContain(cleanHead);
    expect(delivered).not.toContain("Usuario:");
    expect(delivered).not.toContain("LeticiaSim");
  });

  test("handoff strips transcript leaks after short identity answers", () => {
    const cleanHead = "Sim, eu sou Leticia.";
    const leaked = `${cleanHead} Explicacao:
A pergunta do usuario foi clara e objetiva. A minha resposta foi simples e direta, respondendo a pergunta sem ambiguidades.
Continuidade:
continuity\\_anchor: dizer / nome / pode / seu :: responder ao objetivo imediato do usuario
continuity\\_mode: continue LeticiaSim, eu sou Leticia. Explicacao:
A pergunta do usuario foi clara e objetiva.
Continuidade:
continuity\\_anchor: dizer / nome / pode / seu :: responder ao objetivo imediato do usuario
continuity\\_mode: continue
Ola, tudo bem? Voce precisava saber meu nome? Eu sou Leticia. Explicacao:
A pergunta do usuario foi identica a anterior, entao a minha resposta foi repetida sem alteracoes.`;
    const state = createInitialProcessingState("pode me dizer seu nome");
    state.deliveryPayload = {
      channel: "rest",
      text: leaked,
      serialized: { format: "plain-text", text: leaked, payload: { text: leaked }, score: 0.9 },
      stream: { ok: true, component: "stream-chunk-serializer", score: 0.9, text: leaked, chunkCount: 1 },
      citations: [],
    } as any;

    handoffPresentationToFront(state);
    const delivered = `${(state.deliveryPayload as any).text || ""}`;

    expect(delivered).toContain(cleanHead);
    expect(delivered).not.toContain("Usuario:");
    expect(delivered).not.toContain("Leticia:");
    expect(delivered).not.toContain("LeticiaSim");
    expect(delivered).not.toContain("Explicacao:");
    expect(delivered).not.toContain("A pergunta do usuario");
    expect(delivered).not.toContain("Continuidade:");
    expect(delivered).not.toContain("continuity\\_anchor");
    expect(delivered).not.toContain("continuity\\_mode");
  });

  test("handoff rebuilds SSE streams contaminated by escaped continuity metadata", () => {
    const cleanHead = "Sim, eu sou Leticia.";
    const leaked = `${cleanHead} Explicacao:
A pergunta do usuario foi clara e objetiva.
Continuidade:
continuity\\_anchor: dizer / nome / pode / seu :: responder ao objetivo imediato do usuario
continuity\\_mode: continue`;
    const leakedSse = [
      "event: chunk",
      `data: ${JSON.stringify({ index: 0, delta: leaked, cumulativeText: leaked, done: false })}`,
      "",
      "event: done",
      `data: ${JSON.stringify({ done: true, text: leaked })}`,
      "",
    ].join("\n");
    const state = createInitialProcessingState("pode me dizer seu nome");
    state.deliveryPayload = {
      channel: "sse",
      text: leakedSse,
      serialized: { format: "plain-text", text: leaked, payload: { text: leaked }, score: 0.9 },
      stream: { ok: true, component: "stream-chunk-serializer", score: 0.9, text: leakedSse, chunkCount: 1 },
      citations: [],
    } as any;

    handoffPresentationToFront(state);
    const delivered = `${(state.deliveryPayload as any).text || ""}`;
    const payloadText = `${(state.deliveryPayload as any).payload?.text || ""}`;

    expect(payloadText).toBe(cleanHead);
    expect(delivered).toContain(cleanHead);
    expect(delivered).not.toContain("Explicacao:");
    expect(delivered).not.toContain("A pergunta do usuario");
    expect(delivered).not.toContain("Continuidade:");
    expect(delivered).not.toContain("continuity\\\\_anchor");
    expect(delivered).not.toContain("continuity\\\\_mode");
  });

  test("presentation stream sanitizes internal continuity artifacts before serialization", () => {
    const cleanHead = "Sim, eu sou Leticia.";
    const leaked = `${cleanHead} Explicacao:
A pergunta do usuario foi clara e objetiva.
Continuidade:
continuity\\_anchor: dizer / nome / pode / seu
continuity\\_mode: continue`;

    const stream = buildPresentationStream({ text: leaked, channel: "sse" });

    expect(stream.serialized.text).toContain("Sim, eu sou Let");
    expect(stream.serialized.text).not.toContain("Explicacao:");
    expect(stream.serialized.text).not.toContain("A pergunta do usuario");
    expect(stream.serialized.text).not.toContain("Continuidade:");
    expect(stream.serialized.text).not.toContain("continuity\\\\_anchor");
    expect(stream.serialized.text).not.toContain("continuity\\\\_mode");
  });

  test("front delivery builder sanitizes direct presentation-layer calls", () => {
    const cleanHead = "Eu sou Leticia.";
    const leaked = `${cleanHead} Explicacao:
A pergunta do usuario foi clara e objetiva. A minha resposta foi simples e direta.
Continuidade:
continuity\\_anchor: dizer / nome / pode / seu
continuity\\_mode: continue LeticiaSim, eu sou Leticia.`;

    const front = buildPresentationFrontDelivery({
      channel: "sse",
      serialized: {
        format: "plain-text",
        text: leaked,
        payload: { text: leaked },
        score: 0.9,
      },
      citations: [],
      stream: {
        ok: true,
        component: "stream-chunk-serializer",
        score: 0.9,
        text: [
          "event: chunk",
          `data: ${JSON.stringify({ index: 0, delta: leaked, cumulativeText: leaked, done: false })}`,
          "",
          "event: done",
          `data: ${JSON.stringify({ done: true, text: leaked })}`,
          "",
        ].join("\n"),
        chunkCount: 1,
      },
    });

    const delivered = front.delivery.text;
    const payloadText = `${front.delivery.payload?.text || ""}`;

    expect(payloadText).toBe(cleanHead);
    expect(delivered).toContain(cleanHead);
    expect(delivered).not.toContain("Explicacao:");
    expect(delivered).not.toContain("A pergunta do usuario");
    expect(delivered).not.toContain("Continuidade:");
    expect(delivered).not.toContain("continuity\\\\_anchor");
    expect(delivered).not.toContain("continuity\\\\_mode");
    expect(delivered).not.toContain("LeticiaSim");
  });

  test("front delivery builder rebuilds streams with accented transcript leaks", () => {
    const cleanHead = "Retire a fruta da caixa rotulada como Maçãs e Laranjas.";
    const leaked = `${cleanHead} Usuário: obrigado Letícia, mas ainda há algo que não estou entendendo. LetíciaDesculpe-me, mas eu me equivoquei.`;

    const front = buildPresentationFrontDelivery({
      channel: "sse",
      serialized: {
        format: "plain-text",
        text: leaked,
        payload: { text: leaked },
        score: 0.9,
      },
      citations: [],
      stream: {
        ok: true,
        component: "stream-chunk-serializer",
        score: 0.9,
        text: [
          "event: chunk",
          `data: ${JSON.stringify({ index: 0, delta: leaked, cumulativeText: leaked, done: false })}`,
          "",
          "event: done",
          `data: ${JSON.stringify({ done: true, text: leaked })}`,
          "",
        ].join("\n"),
        chunkCount: 1,
      },
    });

    const delivered = front.delivery.text;
    const payloadText = `${front.delivery.payload?.text || ""}`;

    expect(payloadText).toBe(cleanHead);
    expect(delivered).toContain(cleanHead);
    expect(delivered).not.toContain("Usuário:");
    expect(delivered).not.toContain("LetíciaDesculpe");
  });
});
