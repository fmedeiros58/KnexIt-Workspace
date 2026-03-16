export function controlResponseForm(text: string, options: { includeHeading?: boolean; heading?: string } = {}): string {
  const body = text.trim();
  if (!body) return "";
  if (!options.includeHeading) return body;
  const heading = (options.heading || "Resposta").trim();
  return `${heading}:\n${body}`;
}
