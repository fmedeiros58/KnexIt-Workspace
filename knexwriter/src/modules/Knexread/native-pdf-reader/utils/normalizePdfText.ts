export function normalizePdfText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

