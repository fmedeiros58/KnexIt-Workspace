import { taskObligationExtractor } from "../../src/05b-deliberative-task-contract-layer/task-obligation-extractor";

describe("taskObligationExtractor", () => {
  it("extrai obrigacoes explicitas e tipos criticos", () => {
    const prompt = `
Considere um conflito entre tres principios obrigatorios e faca:
(a) demonstre formalmente por que o conflito pode ser inevitavel;
(b) diga se e contradicao real ou inconsistencia de aplicacao;
(c) proponha ao menos dois modelos de solucao;
(d) mostre os custos logicos, morais e institucionais;
(e) construa a melhor objecao contra sua solucao preferida;
(f) reformule a conclusao sob incerteza de medicao;
(g) explicite os pressupostos nao provados.
`;

    const obligations = taskObligationExtractor(prompt);
    expect(obligations.length).toBeGreaterThanOrEqual(7);

    expect(obligations.some((item) => item.type === "demonstration")).toBe(true);
    expect(obligations.some((item) => item.type === "proposal")).toBe(true);
    expect(obligations.some((item) => item.type === "objection")).toBe(true);
    expect(obligations.some((item) => item.type === "reformulation")).toBe(true);
    expect(obligations.some((item) => item.type === "assumption_audit")).toBe(true);
  });
});
