/** ai-system-anm */
export function runFinalSanityCheck(text: string): { ok: boolean; text: string } {
  const original = `${text || ""}`;

  let cleaned = repairCommonMojibake(original);
  cleaned = cleaned.replace(/\u0000/g, "");
  cleaned = stripKnownScaffolding(cleaned);
  cleaned = recoverFromTranscriptLeak(cleaned);
  cleaned = stripDialogueLabels(cleaned);
  cleaned = dedupeRepeatedBlocks(cleaned);
  cleaned = collapseWhitespace(cleaned);

  if (!cleaned || isMeaninglessOutput(cleaned)) {
    return {
      ok: false,
      text: "Não consegui montar uma resposta válida neste turno.",
    };
  }

  return {
    ok: true,
    text: cleaned,
  };
}

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

function normalizeForCompare(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function stripKnownScaffolding(value: string): string {
  return `${value || ""}`
    .replace(/continuando o escopo atual de ['"][^'"]+['"],?\s*/gi, "")
    .replace(/continuando o escopo atual de [^.,;:]+[.,;:]?\s*/gi, "")
    .replace(/com base no contexto (atual|anterior)[^.,;:]*[.,;:]?\s*/gi, "")
    .replace(/resposta calibrada[:\-]?\s*/gi, "")
    .replace(/rascunho final[:\-]?\s*/gi, "")
    .trim();
}

function recoverFromTranscriptLeak(value: string): string {
  const source = `${value || ""}`.trim();
  if (!source) return "";

  const labelPattern =
    /(Usu[aá]rio|Usuario|User|Let[ií]cia|Leticia|Assistant|Assistente)\s*(?::|-)\s*/gi;

  const matches = Array.from(source.matchAll(labelPattern));
  if (matches.length === 0) {
    return source;
  }

  let lastAssistantSegment = "";
  let lastMeaningfulSegment = "";

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? source.length;

    const segment = source
      .slice(start, end)
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "");

    if (!segment) continue;

    lastMeaningfulSegment = segment;

    const label = normalizeForCompare(current[1] || "");
    if (label === "assistant" || label === "assistente" || label === "leticia") {
      lastAssistantSegment = segment;
    }
  }

  return lastAssistantSegment || lastMeaningfulSegment || source;
}

function dedupeRepeatedBlocks(value: string): string {
  const text = `${value || ""}`.trim();
  if (!text) return "";

  const parts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => collapseWhitespace(part))
    .filter(Boolean);

  const seen = new Set<string>();
  const output: string[] = [];

  for (const part of parts) {
    const normalized = normalizeForCompare(part);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    output.push(part);
  }

  return output.join(" ").trim();
}

function isMeaninglessOutput(value: string): boolean {
  const normalized = normalizeForCompare(value);

  if (!normalized) return true;

  if (/^(usuario|user|assistant|assistente|leticia)[: -]*$/.test(normalized)) {
    return true;
  }

  if (/^(nao consegui montar uma resposta valida neste turno\.?)$/.test(normalized)) {
    return true;
  }

  if (normalized.length < 2) {
    return true;
  }

  return false;
}