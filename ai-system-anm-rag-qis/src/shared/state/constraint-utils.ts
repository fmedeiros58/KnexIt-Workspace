/**
 * Responsabilidade do arquivo:
 * - Padronizar criacao de constraints no formato namespace:valor.
 * - Fornecer utilitarios de merge/deduplicacao com limite de tamanho.
 * - Facilitar auditoria e consulta de constraints por prefixo.
 */
export function toConstraint(namespace: string, value: string) {
  return `${namespace}:${value}`;
}

export function dedupeConstraints(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function mergeConstraints(
  existing: string[] | undefined,
  incoming: string[],
  maxItems = 32,
) {
  return dedupeConstraints([...(existing || []), ...incoming]).slice(-maxItems);
}

export function hasConstraintPrefix(
  constraints: string[] | undefined,
  prefix: string,
) {
  return (constraints || []).some((item) => item.startsWith(`${prefix}:`) || item === prefix);
}
