/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: instruction-constraint-enforcer.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Detectar restrições explícitas no prompt do usuário.
 * - Verificar se a resposta violou essas restrições.
 * - Produzir um resultado auditável com constraints detectadas, violações,
 *   score de aderência e status final de aprovação.
 *
 * Função no pipeline:
 * - Este arquivo NÃO normaliza a resposta final para entrega.
 * - Este arquivo NÃO repara a resposta.
 * - Este arquivo NÃO decide sozinho o bloqueio global.
 * - Este arquivo apenas detecta e aplica constraints instrucionais.
 *
 * Garantias esperadas:
 * - Tornar rastreável quais restrições foram inferidas do prompt.
 * - Tornar explícito quais sinais configuram violação.
 * - Manter compatibilidade com o contrato PromptConstraint atual.
 *
 * Observação:
 * - Como PromptConstraintType ainda não possui um tipo próprio para
 *   "no_examples_generic", esta regra é mapeada para
 *   "no_concrete_examples_initially" por compatibilidade tipada,
 *   mas com descrição própria para auditoria.
 */

import type { PromptConstraint } from "./deliberative-task-contract-types";

export interface ConstraintEnforcementResult {
  constraints: PromptConstraint[];
  violations: string[];
  score: number;
  passed: boolean;
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => `${item || ""}`.trim()).filter(Boolean)));
}

function buildConstraint(
  id: string,
  type: PromptConstraint["type"],
  description: string,
  hard = true,
): PromptConstraint {
  return { id, type, description, hard };
}

function includesNoAuthorsConstraint(normalized: string): boolean {
  return /\b(sem recorrer|without(?:\s+initially)?(?:\s+referring)?).*?\b(autores?|authors?)\b/.test(normalized);
}

function includesNoTheoriesConstraint(normalized: string): boolean {
  return /\b(sem recorrer|without(?:\s+initially)?(?:\s+referring)?).*?\b(teorias?|theories?|escolas?|schools?)\b/.test(
    normalized,
  );
}

function includesNoHistoricalExamplesConstraint(normalized: string): boolean {
  return /\b(sem recorrer|without(?:\s+initially)?(?:\s+referring)?).*?\b(exemplos?\s+historicos?|historical examples?)\b/.test(
    normalized,
  );
}

function includesNoConcreteExamplesInitiallyConstraint(normalized: string): boolean {
  return /\b(sem exemplos?(?:\s+concretos?)?(?:\s+iniciais?)?|without(?:\s+using)?\s+concrete examples?(?:\s+initially)?)\b/.test(
    normalized,
  );
}

function includesNoGenericExamplesConstraint(normalized: string): boolean {
  return /\b(sem recorrer|without(?:\s+initially)?(?:\s+referring)?).*?\b(exemplos?|examples?)\b/.test(
    normalized,
  );
}

function includesItemByItemConstraint(normalized: string): boolean {
  return /\b(item por item|responda item por item|siga as etapas|follow these steps|step by step)\b/.test(
    normalized,
  );
}

function includesAssumptionsOnlyAtEndConstraint(normalized: string): boolean {
  return /\b(ao final|at the end).*\b(pressupostos?|assumptions?|premissas?|premises?)\b/.test(
    normalized,
  );
}

export function detectPromptConstraints(userPrompt: string): PromptConstraint[] {
  const normalized = normalize(userPrompt);
  if (!normalized) {
    return [];
  }

  const constraints: PromptConstraint[] = [];

  if (includesNoAuthorsConstraint(normalized)) {
    constraints.push(
      buildConstraint(
        "no_authors",
        "no_authors",
        "Nao usar autores ou citacoes de autoridade na etapa inicial.",
      ),
    );
  }

  if (includesNoTheoriesConstraint(normalized)) {
    constraints.push(
      buildConstraint(
        "no_theories",
        "no_theories",
        "Nao recorrer a teorias ou escolas externas na etapa inicial.",
      ),
    );
  }

  if (includesNoHistoricalExamplesConstraint(normalized)) {
    constraints.push(
      buildConstraint(
        "no_historical_examples",
        "no_historical_examples",
        "Nao usar exemplos historicos quando o enunciado os proibir.",
      ),
    );
  }

  if (includesNoConcreteExamplesInitiallyConstraint(normalized)) {
    constraints.push(
      buildConstraint(
        "no_concrete_examples_initially",
        "no_concrete_examples_initially",
        "Nao iniciar a resposta com exemplos concretos ou ilustrativos.",
      ),
    );
  }

  if (includesNoGenericExamplesConstraint(normalized)) {
    constraints.push(
      buildConstraint(
        "no_examples_generic",
        "no_concrete_examples_initially",
        "Nao usar exemplos na resposta quando o enunciado proibir exemplos de forma ampla.",
      ),
    );
  }

  if (includesItemByItemConstraint(normalized)) {
    constraints.push(
      buildConstraint(
        "item_by_item_execution",
        "item_by_item_execution",
        "Executar item por item sem pular subtarefas.",
      ),
    );
  }

  if (includesAssumptionsOnlyAtEndConstraint(normalized)) {
    constraints.push(
      buildConstraint(
        "assumptions_only_at_end",
        "assumptions_only_at_end",
        "Explicitar pressupostos apenas ao final.",
      ),
    );
  }

  return constraints;
}

function checkNoAuthors(responseText: string): boolean {
  const text = `${responseText || ""}`;
  if (/\bet al\./i.test(text)) return true;
  if (/\([A-Z][a-zA-Z-]+,\s*\d{4}[a-z]?\)/.test(text)) return true;
  if (/\b(?:segundo|according to)\s+[A-Z][a-zA-Z-]+/i.test(text)) return true;
  return false;
}

function checkNoTheories(responseText: string): boolean {
  return /\b(utilitar|deontolog|kant|rawls|aristot|marx|foucault|hegel|contractualism|virtue ethics)\b/i.test(
    responseText,
  );
}

function checkHistoricalExample(responseText: string): boolean {
  return /\b(historic|historicamente|segunda guerra|revolucao|imperio|idade media|in\s+\d{4}|em\s+\d{4})\b/i.test(
    responseText,
  );
}

function checkConcreteExampleInitially(responseText: string): boolean {
  const text = `${responseText || ""}`.trim();
  if (!text) return false;

  const firstParagraph =
    text.split(/\n{2,}/g)[0] || text.slice(0, Math.max(120, Math.round(text.length * 0.33)));

  const sanitized = firstParagraph
    .replace(/\b(sem|nao|não)\s+(?:usar\s+|depender\s+de\s+)?(?:por exemplo|for example|exemplos?|examples?)\b/gi, " ")
    .replace(/\bwithout\s+(?:using\s+|depending on\s+)?examples?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /\b(por exemplo|for example|exemplo|example|imagine|caso concreto|uma lei que|a law that)\b/i.test(
    sanitized,
  );
}

function checkGenericExamplesAnywhere(responseText: string): boolean {
  const sanitized = `${responseText || ""}`
    .replace(/\b(sem|nao|não)\s+(?:usar\s+|depender\s+de\s+)?(?:por exemplo|for example|exemplos?|examples?)\b/gi, " ")
    .replace(/\bwithout\s+(?:using\s+|depending on\s+)?examples?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /\b(por exemplo|for example|exemplo|example|imagine|caso concreto)\b/i.test(
    sanitized,
  );
}

function checkAssumptionsTooEarly(responseText: string): boolean {
  const normalized = normalize(responseText);
  if (!normalized) return false;

  const idx = normalized.search(/\b(pressupost|premissa|assumption|premise)\b/);
  if (idx < 0) return false;

  return idx < Math.floor(normalized.length * 0.6);
}

function checkItemByItemMissing(userPrompt: string, responseText: string): boolean {
  const promptItems = (userPrompt.match(/\(\s*[a-z0-9]+\s*\)/gi) || []).length;
  if (promptItems < 3) return false;

  const responseItems = (responseText.match(/\(\s*[a-z0-9]+\s*\)|\n\d+\.\s+|\n-\s+/gi) || []).length;
  return responseItems < Math.min(promptItems, 3);
}

export function enforcePromptConstraints(
  userPrompt: string,
  responseText: string,
): ConstraintEnforcementResult {
  const constraints = detectPromptConstraints(userPrompt);

  if (!constraints.length) {
    return {
      constraints: [],
      violations: [],
      score: 1,
      passed: true,
    };
  }

  const violations: string[] = [];

  for (const constraint of constraints) {
    if (constraint.id === "no_authors" && checkNoAuthors(responseText)) {
      violations.push("violates_no_authors");
    }

    if (constraint.id === "no_theories" && checkNoTheories(responseText)) {
      violations.push("violates_no_theories");
    }

    if (constraint.id === "no_historical_examples" && checkHistoricalExample(responseText)) {
      violations.push("violates_no_historical_examples");
    }

    if (
      constraint.id === "no_concrete_examples_initially" &&
      checkConcreteExampleInitially(responseText)
    ) {
      violations.push("violates_no_concrete_examples_initially");
    }

    if (constraint.id === "no_examples_generic" && checkGenericExamplesAnywhere(responseText)) {
      violations.push("violates_no_examples_generic");
    }

    if (
      constraint.id === "item_by_item_execution" &&
      checkItemByItemMissing(userPrompt, responseText)
    ) {
      violations.push("violates_item_by_item_execution");
    }

    if (
      constraint.id === "assumptions_only_at_end" &&
      checkAssumptionsTooEarly(responseText)
    ) {
      violations.push("violates_assumptions_only_at_end");
    }
  }

  const uniqueViolations = uniqueStrings(violations);
  const score = Math.max(0, Math.min(1, 1 - uniqueViolations.length / Math.max(1, constraints.length)));

  return {
    constraints,
    violations: uniqueViolations,
    score: Number(score.toFixed(4)),
    passed: uniqueViolations.length === 0,
  };
}
