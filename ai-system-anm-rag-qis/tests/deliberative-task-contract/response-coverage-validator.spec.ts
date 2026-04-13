import { responseCoverageValidator } from "../../src/05b-deliberative-task-contract-layer/response-coverage-validator";
import { reasoningContractBuilder } from "../../src/05b-deliberative-task-contract-layer/reasoning-contract-builder";
import { argumentativeDepthDetector } from "../../src/05b-deliberative-task-contract-layer/argumentative-depth-detector";
import { taskObligationExtractor } from "../../src/05b-deliberative-task-contract-layer/task-obligation-extractor";

describe("responseCoverageValidator", () => {
  it("marca pseudo-profundidade como falha dura com bloqueios", () => {
    const prompt =
      "(a) demonstre formalmente; (b) diferencie contradicao de inconsistencia; (c) proponha dois modelos; (e) objecao forte; (f) reformule sob incerteza; (g) explicite pressupostos.";

    const depth = argumentativeDepthDetector(prompt);
    const obligations = taskObligationExtractor(prompt);
    const contract = reasoningContractBuilder(depth, obligations);
    const weakResponse =
      "Ha conflito entre principios e depende do contexto. Um modelo pode funcionar, mas tudo depende. Conclusao: e complexo.";

    const report = responseCoverageValidator({
      obligations,
      contract,
      responseText: weakResponse,
      requiresCounterObjection: true,
      requiresAssumptionAudit: true,
      requiresReformulation: true,
      assumptionLedger: [
        {
          id: "asm_01",
          category: "definition_operational",
          statement: "As definicoes sao estaveis.",
        },
      ],
    });

    expect(report.needsRevision).toBe(true);
    expect(report.missing.length).toBeGreaterThanOrEqual(2);
    expect(report.gateLevel).toBe("hard_fail");
    expect((report.blockingIssues || []).length).toBeGreaterThan(0);
    expect((report.obligationScores || []).length).toBe(obligations.length);
  });

  it("bloqueia saida que apenas reformula o enunciado", () => {
    const prompt =
      "To address the problem of choosing one unique plan among three options (A, B, and C), follow steps (a) to (i): formulate, demonstrate, propose models, compare costs, choose, object, reformulate, and list assumptions.";
    const depth = argumentativeDepthDetector(prompt);
    const obligations = taskObligationExtractor(prompt);
    const contract = reasoningContractBuilder(depth, obligations);
    const mirroredResponse = prompt;

    const report = responseCoverageValidator({
      obligations,
      contract,
      responseText: mirroredResponse,
      userPrompt: prompt,
      requiresCounterObjection: true,
      requiresAssumptionAudit: true,
      requiresReformulation: true,
      assumptionLedger: [],
    });

    expect(report.gateLevel).toBe("hard_fail");
    expect((report.blockingIssues || []).some((item) => item.includes("prompt_restatement_detected"))).toBe(true);
  });

  it("bloqueia violacao metodologica e truncamento", () => {
    const prompt =
      "Sem recorrer inicialmente a autores e sem exemplos concretos iniciais. Siga os itens (a), (b), (c), (d).";
    const depth = argumentativeDepthDetector(prompt);
    const obligations = taskObligationExtractor(prompt);
    const contract = reasoningContractBuilder(depth, obligations);
    const bad =
      "Por exemplo, uma lei pode resolver parte do problema. Segundo Rawls, isso ajuda. Modelo 1:";

    const report = responseCoverageValidator({
      obligations,
      contract,
      responseText: bad,
      userPrompt: prompt,
      requiresCounterObjection: false,
      requiresAssumptionAudit: false,
      requiresReformulation: false,
      assumptionLedger: [],
    });

    expect(report.gateLevel).toBe("hard_fail");
    expect((report.blockingIssues || []).some((item) => item.includes("prompt_constraints_failed"))).toBe(true);
    expect((report.blockingIssues || []).some((item) => item.includes("response_integrity_failed"))).toBe(true);
  });

  it("bloqueia alteracao indevida de premissa forte", () => {
    const prompt =
      "(1) nenhuma decisao coletiva pode reduzir a liberdade basica de um inocente; (2) toda decisao deve maximizar bem-estar agregado.";
    const depth = argumentativeDepthDetector(prompt);
    const obligations = taskObligationExtractor(prompt);
    const contract = reasoningContractBuilder(depth, obligations);
    const bad =
      "A liberdade basica e so uma preferencia relativa. Portanto depende da perspectiva e pode ser flexibilizada.";

    const report = responseCoverageValidator({
      obligations,
      contract,
      responseText: bad,
      userPrompt: prompt,
      requiresCounterObjection: false,
      requiresAssumptionAudit: false,
      requiresReformulation: false,
      assumptionLedger: [],
    });

    expect(report.gateLevel).toBe("hard_fail");
    expect((report.blockingIssues || []).some((item) => item.includes("premise_preservation_failed"))).toBe(true);
  });
});
