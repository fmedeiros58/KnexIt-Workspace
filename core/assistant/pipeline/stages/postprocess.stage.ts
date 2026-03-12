import { OutlineGuardService } from "@/core/assistant/anti_redundancy/outline-guard.service";
import { RedundancyFilterService } from "@/core/assistant/anti_redundancy/redundancy-filter.service";
import { GenericStructureEnforcer } from "@/core/assistant/postprocess/generic-structure.enforcer";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { toRagHistory } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";
import { enforceResponseStructure } from "@/core/chat/perception/response-structure.enforcer";
import type { ConversationPerceptionState } from "@/core/chat/perception/types";
import type { RagQueryService } from "@/core/rag/rag-query-service";

const CTA_MIN_CHARS = 120;
const DEFAULT_REPAIR_PASSES = 1;
const STREAM_PREFIX_BUFFER_MAX_CHARS = 520;

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveIntEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function hasNextStepCta(text: string) {
  const normalized = normalize(text);
  return (
    normalized.includes("se quiser, no proximo passo eu posso") ||
    normalized.includes("if you want, in the next step i can")
  );
}

function resolveLanguageFamily(ctx: PipelineContext) {
  const tag = `${ctx.language?.tag || ""}`.trim().toLowerCase();
  if (tag.startsWith("en")) return "en";
  return "pt";
}

function resolveNextStepAction(ctx: PipelineContext, languageFamily: "pt" | "en") {
  const intent = `${ctx.intent?.type || "general"}`.trim().toLowerCase();
  if (languageFamily === "en") {
    if (intent === "analysis") return "deepen the analysis on a specific axis";
    if (intent === "summary") return "expand the summary into structured topics with examples";
    if (intent === "planning") return "turn this into an execution plan with concrete steps";
    if (intent === "translation") return "deliver a bilingual version with terminology notes";
    return "refine the answer to the depth and tone you prefer";
  }
  if (intent === "analysis") return "aprofundar a analise em um eixo especifico";
  if (intent === "summary") return "expandir a sintese em topicos estruturados com exemplos";
  if (intent === "planning") return "transformar isso em um plano de execucao com etapas concretas";
  if (intent === "translation") return "entregar uma versao bilingue com notas de terminologia";
  return "refinar a resposta no nivel de detalhe e tom que voce preferir";
}

function buildNextStepCta(ctx: PipelineContext, text: string) {
  const normalized = normalize(text);
  if (!normalized || normalized.length < CTA_MIN_CHARS) return "";
  if (ctx.mode !== "chat") return "";
  if (hasNextStepCta(normalized)) return "";
  if ((ctx.constraints || []).includes("sem_fuga_escopo")) return "";

  const languageFamily = resolveLanguageFamily(ctx);
  const action = resolveNextStepAction(ctx, languageFamily);
  if (languageFamily === "en") {
    return `If you want, in the next step I can ${action}.`;
  }
  return `Se quiser, no proximo passo eu posso ${action}.`;
}

function buildRepairPrompt(ctx: PipelineContext, repairPrompt: string, baseText: string) {
  const targetLanguage = `${ctx.language?.tag || process.env.ACADEMIC_DEFAULT_LANG || "pt-BR"}`.trim();
  const normalizedLanguage = targetLanguage.toLowerCase();
  if (normalizedLanguage.startsWith("en")) {
    return [
      "You are in repair mode for an academic text.",
      `Target language: ${targetLanguage}.`,
      "Respect all listed template constraints and do not invent information.",
      repairPrompt,
      "",
      "TEXT TO REPAIR:",
      baseText,
    ].join("\n");
  }
  return [
    "Voce esta no modo de reparo para texto academico.",
    `Idioma alvo: ${targetLanguage}.`,
    "Respeite o template, remova redundancias e nao invente informacoes.",
    repairPrompt,
    "",
    "TEXTO PARA REPARO:",
    baseText,
  ].join("\n");
}

function normalizeFold(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return `${value || ""}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAnswerLabelPrefix(text: string) {
  let output = `${text || ""}`.trimStart();
  output = output.replace(/^\(*\s*(?:resposta|response|answer)\s*[:：-]\s*/i, "");
  output = output.replace(/^\)\s*/, "");
  output = output.replace(/^\s*(?:resposta|response|answer)\s*[:：-]\s*/i, "");
  return output;
}

function stripQuestionAnswerEnvelope(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized.startsWith("pergunta:") && !normalized.startsWith("question:")) return text;
  const answerMatch = text.match(/(?:resposta|answer|response)\s*[:：-]\s*/i);
  if (!answerMatch || answerMatch.index === undefined) return text;
  return text.slice(answerMatch.index + answerMatch[0].length).trimStart();
}

function stripEchoedUserMessage(text: string, userMessage: string) {
  const message = `${userMessage || ""}`.trim();
  if (!message || message.length > 180) return text;
  const escapedMessagePattern = escapeRegex(message).replace(/\s+/g, "\\s+");
  const patterns = [
    new RegExp(`^\\s*${escapedMessagePattern}\\s*(?:\\n+|[-–—:：]+\\s*|$)`, "i"),
    new RegExp(`^\\s*[\"'“”‘’]?${escapedMessagePattern}[\"'“”‘’]?\\s*(?:\\n+|[-–—:：]+\\s*|$)`, "i"),
  ];
  for (const pattern of patterns) {
    if (!pattern.test(text)) continue;
    return text.replace(pattern, "").trimStart();
  }
  return text;
}


function trimOuterParentheses(text: string) {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) return trimmed;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner || /[()]/.test(inner)) return trimmed;
  return inner;
}

function stripPersonaLabelPrefix(text: string) {
  let output = `${text || ""}`.trimStart();
  output = output.replace(/^\s*(?:leticia|l\.e\.t\.i\.c\.i\.a|assistente|assistant)\s*[:\-]\s*/i, "");
  output = output.replace(/^\s*["']?(?:leticia|l\.e\.t\.i\.c\.i\.a)["']?\s*[:\-]\s*/i, "");
  return output;
}

function isVerifiableCurrentQuestion(value: string) {
  const normalized = normalizeFold(value);
  if (!normalized) return false;
  const asksCurrentOffice =
    /\b(reitor|reitora|presidente|prefeito|governador|ministro|secretario|diretor|ceo|rector|chancellor)\b/.test(
      normalized,
    ) && /\b(quem|who|qual|nome|current|atual|hoje|agora)\b/.test(normalized);
  const asksVerifiableData =
    /\b(data|ano|numero|percentual|taxa|fonte|citacao|referencia|lei|norma|resolucao|preco|valor|dosagem|dose|mg|ml)\b/.test(
      normalized,
    );
  return asksCurrentOffice || asksVerifiableData;
}

function hasScopedDocumentInput(ctx: PipelineContext) {
  if (ctx.ragInput.composerBound === true) return true;
  if (Number.isFinite(Number(ctx.ragInput.documentId)) && Number(ctx.ragInput.documentId) > 0) return true;
  if (Array.isArray(ctx.ragInput.documentIds) && ctx.ragInput.documentIds.some((row) => Number(row) > 0)) return true;
  if (Array.isArray(ctx.attachments) && ctx.attachments.length > 0) return true;
  return false;
}

function hasPositiveWebEvidence(ctx: PipelineContext) {
  return (ctx.evidence || []).some((row) => {
    const ref = `${row.ref || ""}`.trim().toLowerCase();
    const text = `${row.text || ""}`.trim();
    if (ref === "web:missing") return false;
    if (ref.startsWith("web:")) return true;
    return /\[web\]/i.test(text) && !/\[web_required\]/i.test(text);
  });
}

function hasWebVerificationFailureSignal(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  return (
    /\b(nao consegui validar|verificacao web falhou|preciso verificar|sem base verificavel)\b/.test(normalized) ||
    /\b(cannot verify|web verification failed|insufficient evidence|need to verify)\b/.test(normalized)
  );
}

function hasPersonaPolicyLeak(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  return (
    /\b(i won t reveal internal processes|responding professionally and objectively|inside knexit)\b/.test(normalized) ||
    /\b(nao vou revelar processos internos|ia nativa do ecossistema|respondo com naturalidade objetividade)\b/.test(
      normalized,
    ) ||
    /\b(assistente interno|plataforma knexit|nao sou leticia|nao exponho processos internos)\b/.test(normalized) ||
    /\b(respondo como uma pessoa util e profissional|se houver saudacao|nao uso observacoes|comentarios sobre regras e diretrizes)\b/.test(
      normalized,
    )
  );
}

function buildMissingWebVerificationReply(ctx: PipelineContext) {
  const languageFamily = resolveLanguageFamily(ctx);
  if (languageFamily === "en") {
    return "I could not validate this fact with web sources in this turn. To avoid outdated information, I need to rerun multi-source verification before confirming it.";
  }
  return "Nao consegui validar esse fato em fontes web neste turno. Para evitar informacao desatualizada, preciso repetir a verificacao multifonte antes de confirmar.";
}

function enforceVerifiableWebGuard(ctx: PipelineContext, text: string) {
  const forceMultiSource = parseBooleanEnv(process.env.KNEXAI_FORCE_MULTI_SOURCE_WEB_SEARCH, true);
  if (!forceMultiSource) return text;
  if (!isVerifiableCurrentQuestion(ctx.userMessage)) return text;
  if (hasScopedDocumentInput(ctx)) return text;
  if (hasPersonaPolicyLeak(text)) return buildMissingWebVerificationReply(ctx);
  if (hasPositiveWebEvidence(ctx)) return text;
  if (hasWebVerificationFailureSignal(text)) return text;
  return buildMissingWebVerificationReply(ctx);
}

function stripLeadingGreetingForVerifiableQuestion(text: string, userMessage: string) {
  if (!isVerifiableCurrentQuestion(userMessage)) return text;
  let output = `${text || ""}`.trimStart();
  output = output.replace(/^\s*(?:oi|ola|olá|bom dia|boa tarde|boa noite)[^.!?]*[.!?]\s*/i, "");
  output = output.replace(/^\s*(?:usuario|usuário|user)\s*[,:\-]\s*/i, "");
  return output;
}

function foldLoose(value: string) {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingAnswerWrapper(text: string) {
  let output = `${text || ""}`.trim();
  const pattern =
    /[\(\[]\s*(?:resposta|response|answer)(?:\s+em\s+(?:portugues|portugu[e?]s|english|ingles|espanol|espa?ol)(?:\s+brasileiro)?)?\s*[:\-]\s*([\s\S]*?)\s*[\)\]]\s*$/i;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const match = output.match(pattern);
    if (!match || match.index === undefined) break;
    const prefix = output.slice(0, match.index).trim();
    const inner = `${match[1] || ""}`.trim();
    if (!inner) {
      output = prefix;
      continue;
    }
    if (!prefix) {
      output = inner;
      continue;
    }
    const foldedPrefix = foldLoose(prefix);
    const foldedInner = foldLoose(inner);
    if (
      foldedPrefix &&
      foldedInner &&
      (foldedPrefix === foldedInner || foldedPrefix.endsWith(foldedInner) || foldedInner.endsWith(foldedPrefix))
    ) {
      output = prefix;
      continue;
    }
    output = prefix;
  }
  return output;
}

function sanitizeChatArtifacts(text: string, userMessage: string) {
  let output = `${text || ""}`;
  if (!output.trim()) return "";
  output = stripPersonaLabelPrefix(output);
  output = stripEchoedUserMessage(output, userMessage);
  output = stripQuestionAnswerEnvelope(output);
  output = stripAnswerLabelPrefix(output);
  output = stripTrailingAnswerWrapper(output);
  output = stripLeadingGreetingForVerifiableQuestion(output, userMessage);
  output = trimOuterParentheses(output);
  output = output.replace(/^\s*[-–—:：]\s*/, "");
  output = output.replace(/\n{3,}/g, "\n\n").trim();
  return output;
}

function createChatStreamSanitizerStream(stream: ReadableStream<Uint8Array>, userMessage: string) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      let prefixBuffer = "";
      let prefixFlushed = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || !value.length) continue;
          const chunkText = decoder.decode(value, { stream: true });
          if (!chunkText) continue;
          if (!prefixFlushed) {
            prefixBuffer += chunkText;
            const shouldFlushPrefix =
              prefixBuffer.length >= STREAM_PREFIX_BUFFER_MAX_CHARS ||
              /\n\n/.test(prefixBuffer) ||
              /[.!?)]\s*$/.test(prefixBuffer);
            if (!shouldFlushPrefix) continue;
            const sanitizedPrefix = sanitizeChatArtifacts(prefixBuffer, userMessage);
            if (sanitizedPrefix) controller.enqueue(encoder.encode(sanitizedPrefix));
            prefixFlushed = true;
            prefixBuffer = "";
            continue;
          }
          controller.enqueue(encoder.encode(chunkText));
        }
        const tail = decoder.decode();
        if (!prefixFlushed) {
          const sanitized = sanitizeChatArtifacts(`${prefixBuffer}${tail}`, userMessage);
          if (sanitized) controller.enqueue(encoder.encode(sanitized));
        } else if (tail) {
          controller.enqueue(encoder.encode(tail));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function createVerifiableGuardedChatStream(stream: ReadableStream<Uint8Array>, ctx: PipelineContext) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      let text = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || !value.length) continue;
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        let finalText = enforceChatResponseStructure(ctx, text);
        finalText = enforceVerifiableWebGuard(ctx, finalText);
        if (finalText) controller.enqueue(encoder.encode(finalText));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function toConversationPerceptionState(ctx: PipelineContext): ConversationPerceptionState {
  const fallback: ConversationPerceptionState = {
    active_topic: "conversa em andamento",
    active_subtopic: "",
    active_task: "responder ao objetivo imediato do usuario",
    active_text_reference: "",
    user_constraints: ctx.constraints || [],
    required_style: "resposta contextualizada e natural",
    response_mode: "conversation",
    unresolved_pending_point: "",
    last_contextual_decision: "",
    continuity_anchor: "",
    continuity_mode: "continue",
    updated_at: Date.now(),
  };
  const raw = ctx.processState && typeof ctx.processState === "object" ? (ctx.processState as Record<string, unknown>) : null;
  if (!raw) return fallback;
  const state = raw.conversation_state;
  if (!state || typeof state !== "object") return fallback;
  const row = state as Record<string, unknown>;
  return {
    active_topic: `${row.active_topic || fallback.active_topic}`,
    active_subtopic: `${row.active_subtopic || ""}`,
    active_task: `${row.active_task || fallback.active_task}`,
    active_text_reference: `${row.active_text_reference || ""}`,
    user_constraints: Array.isArray(row.user_constraints)
      ? row.user_constraints.map((item) => `${item || ""}`.trim()).filter(Boolean)
      : fallback.user_constraints,
    required_style: `${row.required_style || fallback.required_style}`,
    response_mode: `${row.response_mode || fallback.response_mode}`,
    unresolved_pending_point: `${row.unresolved_pending_point || ""}`,
    last_contextual_decision: `${row.last_contextual_decision || ""}`,
    continuity_anchor: `${row.continuity_anchor || ""}`,
    continuity_mode:
      row.continuity_mode === "adjust" || row.continuity_mode === "replace" || row.continuity_mode === "continue"
        ? row.continuity_mode
        : "continue",
    updated_at: Number(row.updated_at) || fallback.updated_at,
  };
}

function isMicroSocialPrompt(value: string) {
  const normalized = `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  const patterns = [
    /^(oi|ola|oie|oii|opa|e ai|eae|hey|hello|hi)$/i,
    /^(bom dia|boa tarde|boa noite)$/i,
    /^(como vc esta|como voce esta|tudo bem|blz|beleza)$/i,
    /^(obrigado|obg|valeu|thanks|thank you)$/i,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function resolveChatComplexity(ctx: PipelineContext, answer: string): "micro" | "direct" | "short" | "medium" | "complex" {
  const userMessage = `${ctx.userMessage || ""}`.trim();
  const text = `${answer || ""}`.trim();
  if (isMicroSocialPrompt(userMessage)) return "micro";
  if (text.length <= 140) return "direct";
  if (text.length <= 360) return "short";
  if (text.length <= 1_200) return "medium";
  return "complex";
}

function enforceChatResponseStructure(ctx: PipelineContext, text: string) {
  const sanitized = sanitizeChatArtifacts(text, ctx.userMessage);
  const state = toConversationPerceptionState(ctx);
  const complexity = resolveChatComplexity(ctx, sanitized || text);
  const enforced = enforceResponseStructure(sanitized || text, { state, complexity });
  return enforced || sanitized || text;
}

export class PostprocessStage implements Stage {
  constructor(
    private readonly ragService?: RagQueryService,
    private readonly redundancyFilter = new RedundancyFilterService(),
    private readonly outlineGuard = new OutlineGuardService(),
    private readonly structureEnforcer = new GenericStructureEnforcer(),
  ) {}

  async run(ctx: PipelineContext) {
    ctx.progress.stage = "postprocess";
    if (ctx.stream) {
      if (ctx.mode === "chat" && ctx.finalStream) {
        const sanitizedStream = createChatStreamSanitizerStream(ctx.finalStream, ctx.userMessage);
        if (isVerifiableCurrentQuestion(ctx.userMessage) && !hasScopedDocumentInput(ctx)) {
          ctx.finalStream = createVerifiableGuardedChatStream(sanitizedStream, ctx);
        } else {
          ctx.finalStream = sanitizedStream;
        }
      }
      ctx.progress.filteredRedundancy = true;
      return;
    }

    const draft = `${ctx.finalAnswer || ctx.draftAnswer || ""}`.trim();
    const deduped = this.redundancyFilter.reduce(draft);
    const scoped = this.outlineGuard.preserveScope(deduped, ctx.constraints, ctx.plan);
    const guarded = this.outlineGuard.apply(scoped, ctx);
    let finalText = guarded;
    const skipHeavyAcademicPostprocess = ctx.mode === "chat" && ctx.ragRuntimeMode === "lite";

    const enforcerEnabled = parseBooleanEnv(process.env.ACADEMIC_ENFORCER_ENABLED, true);
    if (!skipHeavyAcademicPostprocess && enforcerEnabled && ctx.templateSpec) {
      const languageTag = `${ctx.language?.tag || process.env.ACADEMIC_DEFAULT_LANG || ctx.templateSpec.langTag}`.trim();
      let enforced = this.structureEnforcer.enforce(finalText, ctx.templateSpec, languageTag);
      ctx.qualityGate = enforced.metrics;
      finalText = enforced.renderedText;

      const repairEnabled = parseBooleanEnv(process.env.ACADEMIC_REPAIR_ENABLED, true);
      const maxRepairPasses = parsePositiveIntEnv(process.env.ACADEMIC_REPAIR_MAX_PASSES, DEFAULT_REPAIR_PASSES);
      let pass = 0;
      while (
        !skipHeavyAcademicPostprocess &&
        repairEnabled &&
        this.ragService &&
        enforced.metrics.needsRepair &&
        pass < maxRepairPasses
      ) {
        const repairPrompt = buildRepairPrompt(ctx, enforced.repairPrompt, finalText);
        const repairResult = await this.ragService.query({
          ...ctx.ragInput,
          question: repairPrompt,
          history: toRagHistory(ctx.conversation),
          requestId: `${ctx.requestId}:repair:${pass + 1}`,
          preferredResponseLanguageId: languageTag,
          pipelineModeOverride: ctx.ragRuntimeMode || ctx.ragInput.pipelineModeOverride,
        });
        const repairedText = `${repairResult.answer || ""}`.trim();
        if (repairedText) {
          finalText = repairedText;
          ctx.ragMetadata = repairResult.metadata;
        }
        enforced = this.structureEnforcer.enforce(finalText, ctx.templateSpec, languageTag);
        ctx.qualityGate = enforced.metrics;
        finalText = enforced.renderedText;
        pass += 1;
      }
    }

    if (ctx.mode === "chat") {
      finalText = enforceChatResponseStructure(ctx, finalText);
      finalText = enforceVerifiableWebGuard(ctx, finalText);
    }

    const nextStepCta = buildNextStepCta(ctx, finalText);
    ctx.finalAnswer = nextStepCta ? `${finalText}\n\n${nextStepCta}` : finalText;
    ctx.progress.filteredRedundancy = true;
  }
}


