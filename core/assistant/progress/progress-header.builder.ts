import type { ProgressSignals, ProgressStage } from "@/core/assistant/progress/progress-signals";
import {
  normalizeProgressHeaderMode,
  normalizeProgressHeaderStyle,
  normalizeProgressHeaderTarget,
  type ProgressHeaderMode,
  type ProgressHeaderStyle,
  type ProgressHeaderTarget,
} from "@/core/assistant/progress/progress-header.mode";

export type ProgressHeaderBuildInput = {
  responseMode: "chat" | "write";
  progress?: Partial<ProgressSignals> | null;
  stage?: ProgressStage;
  langTag?: string;
  requestId?: string;
  usedRag?: boolean;
  readFiles?: boolean;
  mode?: ProgressHeaderMode;
  target?: ProgressHeaderTarget;
  style?: ProgressHeaderStyle;
};

type HeaderLanguage = "pt-BR" | "en";

const PT_STAGE_MESSAGES: Record<ProgressStage, string[]> = {
  idle: ["Aguardando sua solicitacao..."],
  ingest: ["Recebendo sua mensagem...", "Lendo sua pergunta..."],
  language: ["Identificando o idioma...", "Ajustando o idioma da resposta..."],
  intent: ["Entendendo seu objetivo...", "Interpretando o pedido..."],
  genre: ["Selecionando o genero academico...", "Aplicando template de escrita..."],
  retrieval: ["Buscando trechos relevantes...", "Recuperando contexto util..."],
  memory: ["Carregando memoria do chat...", "Reunindo decisoes e contexto..."],
  plan: ["Organizando a resposta...", "Estruturando os pontos principais..."],
  compose: ["Redigindo a resposta...", "Pensando na melhor forma de explicar..."],
  postprocess: ["Refinando e removendo redundancias...", "Finalizando a resposta..."],
  done: ["Pronto.", "Concluido."],
};

const EN_STAGE_MESSAGES: Record<ProgressStage, string[]> = {
  idle: ["Waiting for your request..."],
  ingest: ["Receiving your message...", "Reading your request..."],
  language: ["Detecting response language...", "Adjusting language output..."],
  intent: ["Understanding your goal...", "Interpreting the request..."],
  genre: ["Selecting academic genre...", "Applying writing template..."],
  retrieval: ["Searching relevant passages...", "Retrieving useful context..."],
  memory: ["Loading chat memory...", "Gathering decisions and context..."],
  plan: ["Organizing the answer...", "Structuring key points..."],
  compose: ["Drafting the answer...", "Framing the clearest explanation..."],
  postprocess: ["Refining and removing redundancy...", "Finalizing the response..."],
  done: ["Done.", "Completed."],
};

function normalizeTag(value: string | undefined) {
  const raw = `${value || ""}`.trim().toLowerCase();
  if (!raw) return "pt-br";
  return raw;
}

function resolveHeaderLanguage(langTag?: string): HeaderLanguage {
  const normalized = normalizeTag(langTag);
  if (normalized.startsWith("en")) return "en";
  return "pt-BR";
}

export function stablePick(choices: string[], seed: string): string {
  if (!Array.isArray(choices) || choices.length <= 0) return "";
  const rawSeed = `${seed || "seed"}`;
  let hash = 0;
  for (let idx = 0; idx < rawSeed.length; idx += 1) {
    hash = (hash * 33 + rawSeed.charCodeAt(idx)) >>> 0;
  }
  return choices[hash % choices.length] || choices[0] || "";
}

export class ProgressHeaderBuilder {
  private resolveMode(mode?: ProgressHeaderMode) {
    return normalizeProgressHeaderMode(mode || process.env.ASSISTANT_PROGRESS_HEADER_MODE || "standard");
  }

  private resolveTarget(target?: ProgressHeaderTarget) {
    return normalizeProgressHeaderTarget(target || process.env.ASSISTANT_PROGRESS_HEADER_TARGET || "both");
  }

  private resolveStyle(style?: ProgressHeaderStyle) {
    return normalizeProgressHeaderStyle(style || process.env.ASSISTANT_PROGRESS_HEADER_STYLE || "plain");
  }

  private shouldApply(target: ProgressHeaderTarget, responseMode: "chat" | "write") {
    return target === "both" || target === responseMode;
  }

  private withStyle(style: ProgressHeaderStyle, plain: string, emoji: string) {
    return style === "emoji" ? emoji : plain;
  }

  private resolveStage(input: ProgressHeaderBuildInput): ProgressStage {
    const explicit = input.stage;
    if (explicit) return explicit;
    const byProgress = input.progress?.stage;
    if (byProgress) return byProgress;
    return "done";
  }

  private resolveStageMessage(language: HeaderLanguage, stage: ProgressStage, requestId: string) {
    const dict = language === "en" ? EN_STAGE_MESSAGES : PT_STAGE_MESSAGES;
    const options = dict[stage] || dict.done;
    return stablePick(options, `${requestId}:${stage}:${language}`);
  }

  build(input: ProgressHeaderBuildInput): string {
    const mode = this.resolveMode(input.mode);
    if (mode === "off") return "";

    const target = this.resolveTarget(input.target);
    if (!this.shouldApply(target, input.responseMode)) return "";

    const style = this.resolveStyle(input.style);
    const stage = this.resolveStage(input);
    const lang = resolveHeaderLanguage(input.langTag);
    const requestId = `${input.requestId || "assistant"}`;
    const usedRag = Boolean(input.usedRag ?? input.progress?.usedRag);
    const readFiles = Boolean(input.readFiles ?? input.progress?.readFiles);
    const includesContext = usedRag || readFiles;

    const line1Plain = this.resolveStageMessage(lang, stage, requestId);
    const line1Emoji = `${stage === "done" ? "✅ " : "⏳ "}${line1Plain}`;
    const lines: string[] = [this.withStyle(style, line1Plain, line1Emoji)];
    if (mode === "minimal") return lines[0];

    if (mode === "standard" || mode === "verbose") {
      if (includesContext) {
        const line2Plain = lang === "en" ? "Including retrieved context." : "Incluindo contexto recuperado.";
        const line2Emoji = lang === "en" ? "🔎 Including retrieved context." : "🔎 Incluindo contexto recuperado.";
        lines.push(this.withStyle(style, line2Plain, line2Emoji));
      }
    }

    if (mode === "verbose") {
      const line3Plain =
        lang === "en" ? `Current phase: ${stage}.` : `Fase atual: ${stage}.`;
      const line3Emoji = lang === "en" ? `🧭 Current phase: ${stage}.` : `🧭 Fase atual: ${stage}.`;
      lines.push(this.withStyle(style, line3Plain, line3Emoji));
    }

    return lines.filter(Boolean).slice(0, mode === "verbose" ? 3 : 2).join("\n");
  }
}
