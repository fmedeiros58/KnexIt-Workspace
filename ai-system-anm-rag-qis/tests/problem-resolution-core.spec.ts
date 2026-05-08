import { runProblemResolutionOrchestrator } from "../src/14-reasoning-and-generation-layer/problem-resolution-core/problem-resolution-orchestrator";
import { buildAnswerDraftRepairPlan } from "../src/14-reasoning-and-generation-layer/problem-resolution-core/answer-draft-repair-planner";

describe("14a problem-resolution-core", () => {
  test("detects answer that starts correctly but does not conclude", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Analise as variaveis A, B e C sob as restricoes A > B, B > C e conclua cobrindo todos os casos relevantes.",
      draftAnswer: "Primeiro, A parece maior que B.",
    });

    expect(state.closure.passed).toBe(false);
  });

  test("detects abandoned variable", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Compare os elementos X, Y e Z e entregue conclusao final para os tres elementos.",
      draftAnswer: "X e Y foram comparados e X venceu.",
    });

    expect(state.closure.missingVariables.length).toBeGreaterThan(0);
  });

  test("detects violated explicit constraint", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Avalie as opcoes A e B, mas nao inclua o item C na resposta final.",
      draftAnswer: "A melhor opcao e C porque resolve tudo.",
    });

    expect(state.closure.violatedConstraints.length).toBeGreaterThan(0);
  });

  test("detects omitted mandatory scenario", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Se o custo subir, escolha plano conservador. Se o custo cair, escolha plano agressivo. Avalie os dois cenarios.",
      draftAnswer:
        "No cenario de custo subir, o plano conservador faz sentido. Conclusao: seguir conservador.",
    });

    expect(state.closure.unresolvedScenarios.length).toBeGreaterThan(0);
    expect(state.risks.some((risk) => risk.type === "incomplete_case_analysis")).toBe(true);
  });

  test("detects unsupported conclusion", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "A partir das premissas P e Q, deduza a conclusao sem saltos logicos.",
      draftAnswer:
        "Com certeza a conclusao correta e R, independentemente das premissas.",
    });

    expect(state.closure.unsupportedConclusions.length).toBeGreaterThan(0);
  });

  test("detects elimination claim without elimination coverage", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Se opcao 1 falhar, use opcao 2. Se opcao 2 falhar, use opcao 3. Resolva por deducao completa.",
      draftAnswer: "Por eliminacao, a melhor resposta e opcao 1.",
    });

    expect(
      state.risks.some(
        (risk) => risk.type === "premature_closure" || risk.type === "incomplete_case_analysis",
      ),
    ).toBe(true);
  });

  test("detects undue language shift", () => {
    const state = runProblemResolutionOrchestrator({
      userInput: "Explique em portugues os riscos e a recomendacao final.",
      draftAnswer: "This is the final recommendation with no further details.",
    });

    expect(state.risks.some((risk) => risk.type === "language_shift")).toBe(true);
  });

  test("detects repetition loops", () => {
    const repeatedBlock =
      "A decisao deve preservar restricoes e fechar todos os cenarios antes da conclusao final.";
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Avalie os riscos e forneca uma conclusao robusta, sem repetir blocos.",
      draftAnswer: `${repeatedBlock}\n\n${repeatedBlock}`,
    });

    expect(state.risks.some((risk) => risk.type === "loop_or_repetition")).toBe(true);
  });

  test("flags single-action and observation-limited violations", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Ha tres entidades entity_A, entity_B e entity_C com rotulos incorretos. Voce so pode realizar uma unica acao de observacao em uma unica entidade e nao pode observar as demais. Como determinar corretamente todos os conteudos?",
      draftAnswer:
        "Observe entity_A e depois repita a observacao em cada uma das outras entidades para confirmar uma por vez.",
    });
    const repairPlan = buildAnswerDraftRepairPlan(state);

    expect(
      state.closure.violatedConstraints.some((constraint) =>
        /action_budget|observation_limit|formal_/i.test(constraint),
      ),
    ).toBe(true);
    expect(state.closure.passed).toBe(false);
    expect(repairPlan.requiresRepair).toBe(true);
    expect(
      repairPlan.repairMode === "substantial_revision" ||
        repairPlan.repairMode === "regenerate",
    ).toBe(true);
  });

  test("fails when required scenario branch is not covered", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Se a unica observacao retornar value_1, aplique branch_1. Se a unica observacao retornar value_2, aplique branch_2. Determine todos os casos.",
      draftAnswer:
        "No caso branch_1 com value_1, entity_A recebe value_2 e entity_B recebe value_3. Conclusao final.",
    });

    expect(state.scenarioCoverage?.passed).toBe(false);
    expect((state.scenarioCoverage?.missingBranches.length || 0) > 0).toBe(true);
    expect(state.closure.unresolvedScenarios.length).toBeGreaterThan(0);
    expect(state.closure.passed).toBe(false);
  });

  test("fails when mapping is incomplete", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Tres entidades entity_A, entity_B e entity_C devem ser associadas a tres valores exclusivos value_1, value_2 e value_3. Determine o mapeamento completo.",
      draftAnswer: "entity_A = value_1; entity_B = value_2. Portanto concluido.",
    });

    expect(state.assignmentConsistency?.passed).toBe(false);
    expect((state.assignmentConsistency?.missingAssignments.length || 0) > 0).toBe(true);
    expect(state.closure.missingVariables.length).toBeGreaterThan(0);
    expect(state.closure.passed).toBe(false);
  });

  test("passes with full branch coverage, budget compliance and complete mapping", () => {
    const state = runProblemResolutionOrchestrator({
      userInput:
        "Tres entidades entity_A, entity_B e entity_C devem ser associadas a tres valores exclusivos value_1, value_2 e value_3. Voce pode fazer apenas uma observacao em uma unica entidade e nao pode observar as demais. Se a observacao retornar value_1, siga branch_1. Se retornar value_2, siga branch_2.",
      draftAnswer:
        "Fazemos uma unica observacao em entity_B. Se a observacao retornar value_1 (branch_1), entao entity_B=value_1, entity_A=value_2 e entity_C=value_3. Se a observacao retornar value_2 (branch_2), entao entity_B=value_2, entity_A=value_3 e entity_C=value_1. Em ambos os casos o mapeamento fica completo e exclusivo, portanto conclusao final suportada.",
    });

    expect(state.closure.passed).toBe(true);
    expect(state.closure.violatedConstraints.length).toBe(0);
    expect(state.closure.unresolvedScenarios.length).toBe(0);
    expect(state.assignmentConsistency?.passed).toBe(true);
    expect(state.scenarioCoverage?.passed).toBe(true);
  });
});
