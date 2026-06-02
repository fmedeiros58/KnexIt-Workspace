export function buildPdfQuote(text: string) {
  const clean = text.trim();
  return clean ? `"${clean}"` : "";
}

