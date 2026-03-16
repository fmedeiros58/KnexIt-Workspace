export function selectSpecialistModel(domain: string): string {
  const normalized = domain.trim().toLowerCase();
  if (normalized.includes("code") || normalized.includes("dev")) return "specialist-code";
  if (normalized.includes("legal") || normalized.includes("jurid")) return "specialist-legal";
  return "specialist-general";
}
