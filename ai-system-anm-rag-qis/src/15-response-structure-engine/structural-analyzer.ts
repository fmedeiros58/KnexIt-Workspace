export function analyzeStructure(text: string): {
  paragraphs: string[];
  sentenceCount: number;
  hasList: boolean;
} {
  const cleaned = text.replace(/\r/g, "").trim();
  const paragraphs = cleaned ? cleaned.split(/\n{2,}/g).map((item) => item.trim()).filter(Boolean) : [];
  const sentenceCount = (cleaned.match(/[.!?](\s|$)/g) || []).length;
  const hasList = /^\s*[-*\d]+[.)]?\s+/m.test(cleaned);
  return { paragraphs, sentenceCount, hasList };
}
