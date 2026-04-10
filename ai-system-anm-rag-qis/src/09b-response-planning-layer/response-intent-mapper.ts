/** ai-system-anm */

export type ResponseIntent =
  | "direct"
  | "explanatory"
  | "comparative"
  | "stepwise"
  | "clarifying";

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

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function normalize(text: string): string {
  return stripDialogueLabels(repairCommonMojibake(`${text || ""}`))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasComparativeSignal(text: string): boolean {
  return /\b(entre|compar|versus|vs\b|melhor|pior|diferenca entre|qual deles|qual delas|mais vantajoso|mais vantajosa|comparacao)\b/.test(
    text,
  );
}

function hasStepwiseSignal(text: string): boolean {
  return /\b(passo a passo|etapas|como faco|como fazer|me mostre como|procedimento|instrucoes|guia|roteiro de execucao)\b/.test(
    text,
  );
}

function hasExplanatorySignal(text: string): boolean {
  return /\b(explique|detalhe|aprofunde|por que|porque|como funciona|qual a logica|justifique|fundamente|desenvolva)\b/.test(
    text,
  );
}

function hasClarifyingSignal(text: string): boolean {
  return /\b(nao entendi|não entendi|pode esclarecer|pode clarificar|duvida|dúvida|o que quis dizer|pode reformular|explique melhor|mais claro)\b/.test(
    text,
  );
}

function isVeryShortDirectPrompt(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.length > 5) return false;

  return /\b(qual|quem|quando|onde|quanto|cite|liste|diga|resuma|defina|conceitue)\b/.test(text);
}

export function mapResponseIntent(text: string): ResponseIntent {
  const normalized = normalize(text);
  if (!normalized) return "direct";

  const comparative = hasComparativeSignal(normalized);
  const stepwise = hasStepwiseSignal(normalized);
  const explanatory = hasExplanatorySignal(normalized);
  const clarifying = hasClarifyingSignal(normalized);

  if (stepwise) return "stepwise";
  if (comparative) return "comparative";
  if (clarifying && !explanatory) return "clarifying";
  if (explanatory) return "explanatory";
  if (clarifying) return "clarifying";
  if (isVeryShortDirectPrompt(normalized)) return "direct";

  return "direct";
}