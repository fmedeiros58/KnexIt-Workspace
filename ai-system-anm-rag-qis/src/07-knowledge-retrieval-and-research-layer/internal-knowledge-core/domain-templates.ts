export function resolveDomainTemplate(domain: string): { domain: string; focus: string[] } {
  const normalized = domain.trim().toLowerCase();
  if (normalized.includes("legal") || normalized.includes("jurid")) {
    return { domain: "legal", focus: ["base normativa", "jurisdicao", "limites de interpretacao"] };
  }
  if (normalized.includes("med") || normalized.includes("saude")) {
    return { domain: "health", focus: ["seguranca", "evidencia clinica", "cautela"] };
  }
  if (normalized.includes("fin")) {
    return { domain: "finance", focus: ["risco", "cenarios", "premissas"] };
  }
  return { domain: normalized || "general", focus: ["contexto", "evidencia", "conclusao"] };
}
