export function optimizeReadability(text: string, maxParagraphChars = 420): string {
  const paragraphs = text.split(/\n{2,}/g).map((item) => item.trim()).filter(Boolean);
  const optimized: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxParagraphChars) {
      optimized.push(paragraph);
      continue;
    }

    const sentences = paragraph.split(/(?<=[.!?])\s+/g);
    let buffer = "";
    for (const sentence of sentences) {
      const next = buffer ? `${buffer} ${sentence}` : sentence;
      if (next.length > maxParagraphChars && buffer) {
        optimized.push(buffer.trim());
        buffer = sentence;
      } else {
        buffer = next;
      }
    }
    if (buffer.trim()) optimized.push(buffer.trim());
  }

  return optimized.join("\n\n").trim();
}
