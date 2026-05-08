export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";

  return new Date(parsed).toLocaleString("pt-BR");
}

