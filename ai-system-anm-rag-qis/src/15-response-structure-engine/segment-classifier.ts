import type { SegmentKind } from "./types";

function normalizeAscii(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function classifySegment(text: string): SegmentKind {
  if (!text) return "fragment";

  const normalized = normalizeAscii(text);

  if (
    /^(status epistemico:|confianca estimada:|detalhamento:|sequencia de tarefas:|leitura alternativa:|caminho direto:|raciocinio multihipotese:|suporte abdutivo:|sintese:|base inferencial:|caveats?:)/i.test(
      normalized,
    ) ||
    /^pensou por \d+ms$/i.test(normalized)
  ) {
    return "internal";
  }

  if (/^(introducao|contexto|analise|conclusao):?$/i.test(normalized)) {
    return "heading";
  }

  if (/^(em resumo|em sintese|conclusao):?/i.test(normalized)) {
    return "conclusion";
  }

  if (/^(\d+\.|[a-z]\)|[-*])\s+/i.test(text)) {
    return "list";
  }

  if (text.length < 55 && !/[.!?]$/.test(text)) {
    return "fragment";
  }

  return "paragraph";
}
