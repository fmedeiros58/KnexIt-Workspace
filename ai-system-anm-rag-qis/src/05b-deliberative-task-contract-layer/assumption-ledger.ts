import type {
  AssumptionLedgerEntry,
  CognitiveDemandProfile,
  DeliberativeObligation,
  SolutionModel,
} from "./deliberative-task-contract-types";

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function assumptionLedgerBuilder(
  prompt: string,
  obligations: DeliberativeObligation[],
  solutionModels: SolutionModel[],
  profile?: CognitiveDemandProfile,
): AssumptionLedgerEntry[] {
  const normalized = normalize(prompt);
  const assumptions: AssumptionLedgerEntry[] = [];

  assumptions.push({
    id: "asm_01",
    category: "definition_operational",
    statement: "Os termos centrais foram usados com definicoes operacionais suficientemente estaveis.",
  });
  assumptions.push({
    id: "asm_02",
    category: "comparability",
    statement: "Os criterios relevantes sao comparaveis na mesma moldura de decisao.",
  });
  assumptions.push({
    id: "asm_03",
    category: "applicability_condition",
    statement: "As condicoes do caso permitem aplicar o metodo proposto sem contradicoes externas criticas.",
  });

  if (profile?.cognitiveDemands.includes("uncertainty_handling") || /\b(incerteza|estimad|probabilidad)\b/.test(normalized)) {
    assumptions.push({
      id: "asm_04",
      category: "measurability",
      statement: "As estimativas usadas sao informativas o bastante para orientar a escolha, mesmo sem precisao total.",
    });
  }

  if (profile?.taskArchetypes.includes("diagnose")) {
    assumptions.push({
      id: "asm_05",
      category: "selection_criterion",
      statement: "Os sinais observados sao representativos das causas mais provaveis e nao apenas correlacoes superficiais.",
    });
  }

  if (obligations.some((item) => item.type === "planning" || item.type === "decision")) {
    assumptions.push({
      id: "asm_06",
      category: "institutional_stability",
      statement: "Existe capacidade operacional para executar e revisar o plano sugerido no horizonte considerado.",
    });
  }

  if (solutionModels.length > 0) {
    assumptions.push({
      id: "asm_07",
      category: "moral_category",
      statement: "O criterio usado para escolher entre alternativas e normativamente aceitavel para o contexto.",
    });
  }

  return assumptions;
}
