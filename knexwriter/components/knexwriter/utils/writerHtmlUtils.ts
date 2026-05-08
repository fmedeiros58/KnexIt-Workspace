export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function decodeBasicHtmlEntities(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export function getTextFromHtml(html: string) {
  if (!html.trim()) return "";

  const withoutScriptsAndStyles = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");

  const withBlockBreaks = withoutScriptsAndStyles
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/\s*(p|div|li|blockquote|h[1-6]|section|article|ul|ol)\s*>/gi, " ");

  const withoutTags = withBlockBreaks.replace(/<[^>]+>/g, " ");

  return decodeBasicHtmlEntities(withoutTags).replace(/\s+/g, " ").trim();
}

export function getHeadingsFromHtml(html: string) {
  if (!html.trim()) return [] as Array<{ level: number; text: string }>;

  const headingRegex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Array<{ level: number; text: string }> = [];
  let match: RegExpExecArray | null = headingRegex.exec(html);

  while (match) {
    const level = Number(match[1]);
    const text = getTextFromHtml(match[2] || "").replace(/\s+/g, " ").trim();

    if (text) {
      headings.push({ level: Number.isFinite(level) ? level : 1, text });
    }

    match = headingRegex.exec(html);
  }

  return headings;
}

export function getWordCountFromHtml(html: string) {
  const text = getTextFromHtml(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function normalizeTextToEditableHtml(text: string, title?: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return title ? `<h1>${escapeHtml(title)}</h1><p></p>` : "<p></p>";
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block: string) => block.trim())
    .filter(Boolean)
    .map((block: string) => `<p>${escapeHtml(block).replaceAll("\n", "<br/>")}</p>`)
    .join("");

  return title ? `<h1>${escapeHtml(title)}</h1>${blocks}` : blocks;
}

export function trimLeadingEmptyBlocksFromHtml(html: string) {
  const normalized = html.trim();
  if (!normalized) return "<p></p>";
  return normalized;
}

export function normalizeImportedLayoutOffsets(html: string) {
  return trimLeadingEmptyBlocksFromHtml(html.trim());
}

