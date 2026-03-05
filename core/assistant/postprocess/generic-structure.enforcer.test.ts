import { AcademicGenre } from "@/core/assistant/genre/academic-genre.types";
import { GenericStructureEnforcer } from "@/core/assistant/postprocess/generic-structure.enforcer";
import { TemplateRegistry } from "@/core/assistant/templates/template-registry";

describe("GenericStructureEnforcer", () => {
  it("aplica template e marca secoes obrigatorias ausentes", () => {
    const registry = new TemplateRegistry();
    const template = registry.getTemplate(AcademicGenre.CRITICAL_REVIEW, "pt-BR");
    const enforcer = new GenericStructureEnforcer();
    const input = `
## Sintese do conteudo
O texto apresenta uma visao geral do problema com dois argumentos principais.
`;

    const result = enforcer.enforce(input, template, "pt-BR");
    expect(result.renderedText).toContain("## Identificacao da obra");
    expect(result.renderedText).toContain("Nao informado no trecho.");
    expect(result.metrics.requiredTotal).toBeGreaterThan(0);
    expect(result.metrics.requiredPresent).toBeLessThan(result.metrics.requiredTotal);
    expect(result.metrics.needsRepair).toBe(true);
  });

  it("remove redundancia transversal entre secoes", () => {
    const registry = new TemplateRegistry();
    const template = registry.getTemplate(AcademicGenre.ARTICLE_SUMMARY, "pt-BR");
    const enforcer = new GenericStructureEnforcer();
    const repeated =
      "O estudo mostra impacto significativo na aprendizagem e reforca a necessidade de acompanhamento docente.";
    const input = `
## Contexto e problema
${repeated}

## Resultados
${repeated}
`;

    const result = enforcer.enforce(input, template, "pt-BR");
    expect(result.metrics.redundantPairs).toBeGreaterThanOrEqual(1);
    expect(result.renderedText).toContain("## Contexto e problema");
    expect(result.renderedText).toContain("## Resultados");
  });
});
