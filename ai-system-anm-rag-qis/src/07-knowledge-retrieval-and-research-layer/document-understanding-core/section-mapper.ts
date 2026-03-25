export function mapSections(text: string): Array<{ title: string; content: string }> {
  const blocks = text.split(/\n{2,}/g).map((item) => item.trim()).filter(Boolean);
  if (!blocks.length) return [];
  return blocks.map((content, index) => ({
    title: index === 0 ? "Resumo" : `Secao ${index + 1}`,
    content,
  }));
}
