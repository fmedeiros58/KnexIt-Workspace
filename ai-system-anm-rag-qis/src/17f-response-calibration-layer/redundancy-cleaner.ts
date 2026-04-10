/** ai-system-anm */

function repairCommonMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function normalize(value: string): string {
  return stripDialogueLabels(repairCommonMojibake(`${value || ""}`))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitParagraphs(text: string): string[] {
  return `${text || ""}`
    .split(/\n{2,}/g)
    .map((row) => collapseWhitespace(row))
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((row) => collapseWhitespace(row))
    .filter(Boolean);
}

function similarity(a: string, b: string): number {
  const aTokens = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const bTokens = new Set(normalize(b).split(/\s+/).filter(Boolean));

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }

  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function dedupeParagraphs(paragraphs: string[]): string[] {
  const output: string[] = [];

  for (const paragraph of paragraphs) {
    const normalizedParagraph = normalize(paragraph);
    if (!normalizedParagraph) continue;

    const alreadyExists = output.some((existing) => {
      const normalizedExisting = normalize(existing);
      if (normalizedExisting === normalizedParagraph) return true;

      const nearDuplicate =
        similarity(existing, paragraph) >= 0.92 &&
        Math.abs(existing.length - paragraph.length) <= 80;

      return nearDuplicate;
    });

    if (!alreadyExists) {
      output.push(paragraph);
    }
  }

  return output;
}

function dedupeSentencesInsideParagraph(paragraph: string): string {
  const sentences = splitSentences(paragraph);
  if (sentences.length <= 1) return paragraph;

  const output: string[] = [];

  for (const sentence of sentences) {
    const normalizedSentence = normalize(sentence);
    if (!normalizedSentence) continue;

    const repeated = output.some((existing) => {
      const normalizedExisting = normalize(existing);
      if (normalizedExisting === normalizedSentence) return true;

      const nearDuplicate =
        similarity(existing, sentence) >= 0.94 &&
        Math.abs(existing.length - sentence.length) <= 40;

      return nearDuplicate;
    });

    if (!repeated) {
      output.push(sentence);
    }
  }

  return output.join(" ").trim();
}

function removeConsecutiveRepeatedTail(paragraphs: string[]): string[] {
  const output: string[] = [];

  for (const paragraph of paragraphs) {
    const last = output[output.length - 1];
    if (!last) {
      output.push(paragraph);
      continue;
    }

    const exactSame = normalize(last) === normalize(paragraph);
    const nearSame =
      similarity(last, paragraph) >= 0.95 &&
      Math.abs(last.length - paragraph.length) <= 60;

    if (!exactSame && !nearSame) {
      output.push(paragraph);
    }
  }

  return output;
}

export function cleanRedundancy(text: string): string {
  let cleaned = repairCommonMojibake(`${text || ""}`);
  cleaned = stripDialogueLabels(cleaned);
  cleaned = collapseWhitespace(cleaned);

  if (!cleaned) return "";

  const paragraphs = splitParagraphs(cleaned)
    .map((paragraph) => dedupeSentencesInsideParagraph(paragraph))
    .filter(Boolean);

  const dedupedParagraphs = removeConsecutiveRepeatedTail(
    dedupeParagraphs(paragraphs),
  );

  return dedupedParagraphs.join("\n\n").trim();
}