import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { toRagHistory } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";
import type { RagQueryService } from "@/core/rag/rag-query-service";
import { logger } from "@/core/utils/logger";

const DEFAULT_LLM_CONTEXT_WINDOW_TOKENS = 8192;

type ComposePromptCaps = {
  totalMaxChars: number;
  templateMaxChars: number;
  conversationMaxChars: number;
  processStateMaxChars: number;
  prefsMaxChars: number;
  evidenceMaxChars: number;
  planMaxChars: number;
  userMessageMaxChars: number;
};

type PromptSectionSnapshot = {
  name: string;
  originalChars: number;
  finalChars: number;
  truncated: boolean;
};

type PromptBuildAudit = {
  caps: ComposePromptCaps;
  totalCharsBefore: number;
  totalCharsAfter: number;
  hardTruncated: boolean;
  sections: PromptSectionSnapshot[];
};

type PromptBuildResult = {
  prompt: string;
  audit: PromptBuildAudit;
};

function parseBoundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function parseOptionalBooleanEnv(value: string | undefined | null): boolean | undefined {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function resolveLlmContextWindowTokens() {
  const raw = process.env.RAG_LLM_CONTEXT_WINDOW || process.env.LLM_CONTEXT_WINDOW || process.env.VLLM_CONTEXT_WINDOW;
  return parseBoundedInt(raw, DEFAULT_LLM_CONTEXT_WINDOW_TOKENS, 512, 262_144);
}

function resolveComposePromptCaps(): ComposePromptCaps {
  const contextWindowTokens = resolveLlmContextWindowTokens();
  const defaultTotalCap = Math.max(3_000, Math.min(30_000, Math.trunc(contextWindowTokens * 1.6)));
  return {
    totalMaxChars: parseBoundedInt(process.env.COMPOSE_PROMPT_MAX_CHARS, defaultTotalCap, 1_500, 120_000),
    templateMaxChars: parseBoundedInt(process.env.COMPOSE_TEMPLATE_MAX_CHARS, 1_800, 300, 30_000),
    conversationMaxChars: parseBoundedInt(process.env.COMPOSE_CONVERSATION_MAX_CHARS, 2_400, 300, 60_000),
    processStateMaxChars: parseBoundedInt(process.env.COMPOSE_PROCESS_STATE_MAX_CHARS, 1_400, 200, 40_000),
    prefsMaxChars: parseBoundedInt(process.env.COMPOSE_PREFS_MAX_CHARS, 1_000, 120, 20_000),
    evidenceMaxChars: parseBoundedInt(process.env.COMPOSE_EVIDENCE_MAX_CHARS, 3_600, 400, 60_000),
    planMaxChars: parseBoundedInt(process.env.COMPOSE_PLAN_MAX_CHARS, 1_200, 200, 20_000),
    userMessageMaxChars: parseBoundedInt(process.env.COMPOSE_USER_MESSAGE_MAX_CHARS, 3_200, 200, 40_000),
  };
}

function clipToLimit(text: string, maxChars: number, label: string): { value: string; truncated: boolean } {
  const normalized = `${text || ""}`.trim();
  if (!normalized) return { value: "", truncated: false };
  const safeMax = Math.max(48, Math.trunc(maxChars));
  if (normalized.length <= safeMax) {
    return { value: normalized, truncated: false };
  }
  const suffix = `\n...[${label} truncado para caber no limite de contexto]`;
  const bodyCap = Math.max(24, safeMax - suffix.length);
  return {
    value: `${normalized.slice(0, bodyCap).trimEnd()}${suffix}`,
    truncated: true,
  };
}

function renderConversation(conversation: PipelineContext["conversation"]) {
  return (conversation || [])
    .map((row) => `${row.role.toUpperCase()}: ${row.content}`)
    .join("\n")
    .trim();
}

function renderEvidence(ctx: PipelineContext) {
  return (ctx.evidence || [])
    .slice(0, 8)
    .map((row, idx) => {
      const safeText = `${row.text || ""}`.replace(/\s+/g, " ").trim();
      return `[EVIDENCE ${idx + 1}] (${row.source}, score=${Number(row.score || 0).toFixed(4)}, ref=${row.ref}) ${safeText}`;
    })
    .join("\n")
    .trim();
}

function renderPlan(ctx: PipelineContext) {
  const sections = ctx.plan?.sections || [];
  if (!sections.length) return "- Resposta direta";
  return sections
    .map((section) => {
      const bullets = (section.bullets || []).map((bullet) => `  - ${bullet}`).join("\n");
      return bullets ? `- ${section.title}\n${bullets}` : `- ${section.title}`;
    })
    .join("\n");
}

function renderConstraints(ctx: PipelineContext) {
  return (ctx.constraints || []).length ? (ctx.constraints || []).join("; ") : "nenhuma";
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : undefined;
}

function normalizePositiveIntArray(values: unknown, maxItems = 64) {
  if (!Array.isArray(values)) return [] as number[];
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of values) {
    const parsed = parsePositiveInt(raw);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    normalized.push(parsed);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
}

function resolveScopedDocumentIds(ctx: PipelineContext) {
  const fromRagInput = normalizePositiveIntArray(ctx.ragInput.documentIds);
  const fromComposer = normalizePositiveIntArray(ctx.ragInput.composerAttachmentIds);
  const fromAttachments = normalizePositiveIntArray((ctx.attachments || []).map((item) => item.id));
  const documentId = parsePositiveInt(ctx.ragInput.documentId);
  const merged = new Set<number>([...fromRagInput, ...fromComposer, ...fromAttachments]);
  if (documentId) merged.add(documentId);
  return Array.from(merged);
}

function serializeProcessState(ctx: PipelineContext) {
  try {
    return JSON.stringify(ctx.processState || {}, null, 2);
  } catch {
    return "{}";
  }
}

function serializePrefs(ctx: PipelineContext) {
  try {
    return JSON.stringify(ctx.persistentPrefs || {}, null, 2);
  } catch {
    return "{}";
  }
}

function placeholderForMissingInfo(langTag: string) {
  const normalized = `${langTag || ""}`.trim().toLowerCase();
  if (normalized.startsWith("en")) return "Not informed in the excerpt.";
  return "Nao informado no trecho.";
}

function renderTemplate(ctx: PipelineContext) {
  const template = ctx.templateSpec;
  if (!template || !template.sections.length) return "(template nao definido)";
  return template.sections
    .map((section, idx) => {
      const flags = [
        section.required ? "obrigatoria" : "opcional",
        `max_paragrafos=${section.maxParagraphs}`,
        `max_chars=${section.maxChars}`,
        `bullets=${section.allowBullets ? "sim" : "nao"}`,
      ];
      return `${idx + 1}. ${section.title} [${flags.join("; ")}]`;
    })
    .join("\n");
}

function renderConversationState(ctx: PipelineContext) {
  const processState = ctx.processState;
  if (!processState || typeof processState !== "object") return "";
  const summary = (processState as Record<string, unknown>)["conversation_state_summary"];
  if (typeof summary === "string" && summary.trim()) {
    return summary.trim();
  }
  const state = (processState as Record<string, unknown>)["conversation_state"];
  if (!state || typeof state !== "object") return "";
  const row = state as Record<string, unknown>;
  const lines = [
    "[conversation_state]",
    `active_topic: ${`${row.active_topic || ""}`.trim() || "-"}`,
    `active_subtopic: ${`${row.active_subtopic || ""}`.trim() || "-"}`,
    `active_task: ${`${row.active_task || ""}`.trim() || "-"}`,
    `active_text_reference: ${`${row.active_text_reference || ""}`.trim() || "-"}`,
    `required_style: ${`${row.required_style || ""}`.trim() || "-"}`,
    `response_mode: ${`${row.response_mode || ""}`.trim() || "-"}`,
    `continuity_anchor: ${`${row.continuity_anchor || ""}`.trim() || "-"}`,
    `continuity_mode: ${`${row.continuity_mode || ""}`.trim() || "-"}`,
    "[/conversation_state]",
  ];
  return lines.join("\n");
}

function normalizeForVerification(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isVerifiableQuestionForAutoSearch(prompt: string) {
  const normalized = normalizeForVerification(prompt);
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

function hasWebEvidence(ctx: PipelineContext) {
  return (ctx.evidence || []).some((row) => row.ref.startsWith("web:") || /\[WEB\]/i.test(`${row.text || ""}`));
}

export class ComposeStage implements Stage {
  constructor(private readonly ragService: RagQueryService) {}

  private resolveTargetLanguage(ctx: PipelineContext) {
    const explicit = `${ctx.ragInput.preferredResponseLanguageId || ""}`.trim();
    if (explicit) return explicit;
    const detected = `${ctx.language?.tag || ""}`.trim();
    if (detected) return detected;
    return process.env.ACADEMIC_DEFAULT_LANG || "pt-BR";
  }

  private assemblePrompt(params: {
    targetLanguage: string;
    genre: string;
    templateTitle: string;
    noInfoToken: string;
    constraints: string;
    templateSections: string;
    conversation: string;
    processState: string;
    prefs: string;
    evidence: string;
    plan: string;
    userMessage: string;
    mode: PipelineContext["mode"];
    intentType: string;
    intentConfidence: number;
  }) {
    return [
      "CONTRATO DE IDIOMA:",
      `- Responda SOMENTE em: ${params.targetLanguage}.`,
      "- Nao mude para outro idioma sem pedido explicito do usuario.",
      "- Se houver mistura de idiomas, use o idioma dominante da mensagem atual.",
      "",
      "CONTRATO DE GENERO ACADEMICO:",
      `- Gere no genero: ${params.genre}.`,
      `- Template selecionado: ${params.templateTitle}.`,
      "- Use os titulos de secao do template como estrutura principal da resposta.",
      `- Se faltar informacao em secao obrigatoria, escreva exatamente: "${params.noInfoToken}".`,
      "- Nao invente dados, referencias ou resultados nao sustentados por evidencia.",
      "",
      "CONTRATO DE ESPECIFICIDADE:",
      "- A resposta deve refletir diretamente a mensagem atual do usuario.",
      "- Considere a conversa relevante, o estado do processo e as evidencias recuperadas.",
      "- Evite respostas genericas e evite repetir paragrafos entre secoes.",
      "- Respeite todas as restricoes explicitas.",
      "",
      `MODO: ${params.mode}`,
      `INTENCAO: ${params.intentType} (confianca=${Number(params.intentConfidence).toFixed(2)})`,
      `RESTRICOES: ${params.constraints}`,
      "",
      "TEMPLATE (SECOES E REGRAS):",
      params.templateSections || "(template nao definido)",
      "",
      "CONVERSA RELEVANTE:",
      params.conversation || "(nenhuma)",
      "",
      "ESTADO DO PROCESSO:",
      params.processState || "{}",
      "",
      "PREFERENCIAS PERSISTENTES:",
      params.prefs || "{}",
      "",
      "EVIDENCIAS:",
      params.evidence || "(nenhuma)",
      "",
      "PLANO DE RESPOSTA:",
      params.plan || "- Resposta direta",
      "",
      "MENSAGEM DO USUARIO:",
      params.userMessage || "(vazia)",
      "",
      `Escreva agora a resposta final no idioma ${params.targetLanguage}, com foco direto no pedido e no template academico selecionado.`,
    ].join("\n");
  }

  private assembleChatPrompt(params: {
    targetLanguage: string;
    constraints: string;
    conversationState: string;
    conversation: string;
    processState: string;
    prefs: string;
    evidence: string;
    plan: string;
    userMessage: string;
    intentType: string;
    intentConfidence: number;
    hasDocumentScope: boolean;
    scopedDocumentRefs: string;
    forceWebMultiSource: boolean;
    hasWebEvidence: boolean;
    verifiableQuestion: boolean;
  }) {
    return [
      "CONTRATO DE IDIOMA:",
      `- Responda SOMENTE em: ${params.targetLanguage}.`,
      "- Nao alterne idioma sem solicitacao explicita.",
      "",
      "CONTRATO DE CONVERSA DIRETA:",
      "- Responda o objetivo do usuario sem explicar regras, politicas ou processo interno.",
      "- Fale em primeira pessoa como Leticia quando fizer sentido conversacional (ex.: 'eu posso', 'eu lembro').",
      "- Em pedidos sobre nome do usuario, confirme de forma pessoal e natural, sem tom robotico.",
      "- Nao use metalinguagem (ex.: 'nao ha pergunta', 'como IA', 'vou seguir diretrizes').",
      "- Nao gere rotulos artificiais (ex.: '[Paragrafo 1]', '[450-600 caracteres]').",
      "- Nao inclua prefixos como 'Leticia:', 'Assistente:' ou 'Resposta:' na saida final.",
      "- Evite repeticao de frases e evite reiniciar o tema sem solicitacao.",
      "- Em saudacoes/confirmacoes curtas, responda em uma frase natural e objetiva.",
      "- Em perguntas factuais objetivas, responda sem saudacao e sem introducoes longas.",
      "",
      ...(params.forceWebMultiSource
        ? [
            "CONTRATO DE VERIFICACAO WEB MULTI-FONTE (OBRIGATORIO):",
            "- Responda fatos verificaveis com base em evidencias web multi-fonte.",
            "- Se nao houver evidencia web suficiente neste turno, nao chute; informe que a verificacao web falhou e solicite nova tentativa.",
            params.hasWebEvidence
              ? "- Evidencias web detectadas neste turno: use-as como base principal."
              : "- Nenhuma evidencia web detectada neste turno: nao responda fato atual por memoria interna.",
            "",
          ]
        : []),
      ...(params.verifiableQuestion
        ? ["- Esta pergunta e temporal/verificavel: priorize precisao factual e data mais recente valida."]
        : []),
      "",
      "CONTRATO DE CONTINUIDADE:",
      "- Preserve o assunto e a tarefa ativa quando a mensagem for continuacao.",
      "- Use o texto-base ativo quando houver referencia implicita ao texto anterior.",
      "- Trate ajustes como refinamento do mesmo fluxo, salvo troca explicita de assunto.",
      "",
      "CONTRATO DE DOCUMENTO ANEXADO:",
      params.hasDocumentScope
        ? `- Esta resposta esta vinculada ao(s) documento(s) anexado(s): ${params.scopedDocumentRefs}.`
        : "- Nao ha escopo de documento anexado neste turno.",
      params.hasDocumentScope
        ? "- Priorize os trechos recuperados do documento anexado em vez de responder de forma generica."
        : "- Quando nao houver documento anexado, responda direto ao ponto com o contexto conversacional.",
      params.hasDocumentScope
        ? "- Se o documento anexado nao trouxer evidencias suficientes, informe essa limitacao objetivamente e solicite reindexacao/reenvio."
        : "- Sem documento anexado, mantenha objetividade e nao invente fontes.",
      "",
      `INTENCAO: ${params.intentType} (confianca=${Number(params.intentConfidence).toFixed(2)})`,
      `RESTRICOES: ${params.constraints}`,
      "",
      "ESTADO CONVERSACIONAL ATIVO:",
      params.conversationState || "(nao informado)",
      "",
      "CONVERSA RELEVANTE:",
      params.conversation || "(nenhuma)",
      "",
      "ESTADO DO PROCESSO:",
      params.processState || "{}",
      "",
      "PREFERENCIAS PERSISTENTES:",
      params.prefs || "{}",
      "",
      "EVIDENCIAS (use so quando realmente agregarem):",
      params.evidence || "(nenhuma)",
      "",
      "PLANO OPERACIONAL:",
      params.plan || "- Resposta direta",
      "",
      "MENSAGEM DO USUARIO:",
      params.userMessage || "(vazia)",
      "",
      `Escreva agora apenas a resposta final em ${params.targetLanguage}, de forma objetiva, natural e contextualizada.`,
    ].join("\n");
  }

  private buildPromptFromContext(ctx: PipelineContext): PromptBuildResult {
    const targetLanguage = this.resolveTargetLanguage(ctx);
    const constraints = renderConstraints(ctx);
    const scopedDocumentIds = resolveScopedDocumentIds(ctx);
    const hasDocumentScope = scopedDocumentIds.length > 0 || ctx.ragInput.composerBound === true;
    const scopedDocumentRefs = scopedDocumentIds.length
      ? scopedDocumentIds.slice(0, 12).map((id) => `doc:${id}`).join(", ")
      : "nenhum";
    const forceWebMultiSource = parseOptionalBooleanEnv(process.env.KNEXAI_FORCE_MULTI_SOURCE_WEB_SEARCH) !== false;
    const webEvidenceAvailable = hasWebEvidence(ctx);
    const genre = `${ctx.genre || "GENERIC_ACADEMIC"}`;
    const templateTitle = `${ctx.templateSpec?.title || "Template academico generico"}`;
    const noInfoToken = placeholderForMissingInfo(targetLanguage);
    const caps = resolveComposePromptCaps();

    if (ctx.mode === "chat") {
      const rawSections = {
        conversationState: renderConversationState(ctx),
        conversation: renderConversation(ctx.conversation),
        processState: serializeProcessState(ctx),
        prefs: serializePrefs(ctx),
        evidence: renderEvidence(ctx),
        plan: renderPlan(ctx),
        userMessage: `${ctx.userMessage || ""}`.trim(),
      };
      const verifiableQuestion = isVerifiableQuestionForAutoSearch(rawSections.userMessage);
      const conversationStateCap = Math.max(260, Math.min(caps.processStateMaxChars, 1_600));
      const sections = {
        conversationState: clipToLimit(rawSections.conversationState, conversationStateCap, "estado conversacional"),
        conversation: clipToLimit(rawSections.conversation, caps.conversationMaxChars, "conversa"),
        processState: clipToLimit(rawSections.processState, caps.processStateMaxChars, "estado do processo"),
        prefs: clipToLimit(rawSections.prefs, caps.prefsMaxChars, "preferencias"),
        evidence: clipToLimit(rawSections.evidence, caps.evidenceMaxChars, "evidencias"),
        plan: clipToLimit(rawSections.plan, caps.planMaxChars, "plano"),
        userMessage: clipToLimit(rawSections.userMessage, caps.userMessageMaxChars, "mensagem do usuario"),
      };

      const assemble = () =>
        this.assembleChatPrompt({
          targetLanguage,
          constraints,
          conversationState: sections.conversationState.value,
          conversation: sections.conversation.value,
          processState: sections.processState.value,
          prefs: sections.prefs.value,
          evidence: sections.evidence.value,
          plan: sections.plan.value,
          userMessage: sections.userMessage.value,
          intentType: ctx.intent?.type || "geral",
          intentConfidence: Number(ctx.intent?.confidence || 0),
          hasDocumentScope,
          scopedDocumentRefs,
          forceWebMultiSource,
          hasWebEvidence: webEvidenceAvailable,
          verifiableQuestion,
        });

      const originalPrompt = assemble();
      let prompt = originalPrompt;
      if (prompt.length > caps.totalMaxChars) {
        const shrinkPlan: Array<{ key: keyof typeof sections; min: number; ratio: number; label: string }> = [
          { key: "evidence", min: 320, ratio: 0.52, label: "evidencias" },
          { key: "conversation", min: 260, ratio: 0.55, label: "conversa" },
          { key: "processState", min: 220, ratio: 0.6, label: "estado do processo" },
          { key: "prefs", min: 160, ratio: 0.62, label: "preferencias" },
          { key: "plan", min: 160, ratio: 0.62, label: "plano" },
          { key: "conversationState", min: 220, ratio: 0.65, label: "estado conversacional" },
          { key: "userMessage", min: 260, ratio: 0.72, label: "mensagem do usuario" },
        ];
        for (const step of shrinkPlan) {
          if (prompt.length <= caps.totalMaxChars) break;
          const current = sections[step.key].value;
          if (!current) continue;
          const nextLimit = Math.max(step.min, Math.trunc(current.length * step.ratio));
          sections[step.key] = clipToLimit(current, nextLimit, step.label);
          prompt = assemble();
        }
      }

      if (prompt.length > caps.totalMaxChars) {
        sections.conversation = { value: "(conversa resumida por limite de contexto)", truncated: true };
        sections.processState = { value: "{}", truncated: true };
        sections.prefs = { value: "{}", truncated: true };
        sections.evidence = { value: "(evidencias omitidas por limite de contexto)", truncated: true };
        sections.plan = { value: "- Resposta direta", truncated: true };
        prompt = assemble();
      }

      let hardTruncated = false;
      if (prompt.length > caps.totalMaxChars) {
        prompt = clipToLimit(prompt, caps.totalMaxChars, "prompt consolidado").value;
        hardTruncated = true;
      }

      const audit: PromptBuildAudit = {
        caps,
        totalCharsBefore: originalPrompt.length,
        totalCharsAfter: prompt.length,
        hardTruncated,
        sections: [
          {
            name: "conversationState",
            originalChars: rawSections.conversationState.length,
            finalChars: sections.conversationState.value.length,
            truncated:
              sections.conversationState.truncated ||
              sections.conversationState.value.length < rawSections.conversationState.length,
          },
          {
            name: "conversation",
            originalChars: rawSections.conversation.length,
            finalChars: sections.conversation.value.length,
            truncated: sections.conversation.truncated || sections.conversation.value.length < rawSections.conversation.length,
          },
          {
            name: "processState",
            originalChars: rawSections.processState.length,
            finalChars: sections.processState.value.length,
            truncated: sections.processState.truncated || sections.processState.value.length < rawSections.processState.length,
          },
          {
            name: "prefs",
            originalChars: rawSections.prefs.length,
            finalChars: sections.prefs.value.length,
            truncated: sections.prefs.truncated || sections.prefs.value.length < rawSections.prefs.length,
          },
          {
            name: "evidence",
            originalChars: rawSections.evidence.length,
            finalChars: sections.evidence.value.length,
            truncated: sections.evidence.truncated || sections.evidence.value.length < rawSections.evidence.length,
          },
          {
            name: "plan",
            originalChars: rawSections.plan.length,
            finalChars: sections.plan.value.length,
            truncated: sections.plan.truncated || sections.plan.value.length < rawSections.plan.length,
          },
          {
            name: "userMessage",
            originalChars: rawSections.userMessage.length,
            finalChars: sections.userMessage.value.length,
            truncated: sections.userMessage.truncated || sections.userMessage.value.length < rawSections.userMessage.length,
          },
        ],
      };
      return { prompt, audit };
    }

    const rawSections = {
      templateSections: renderTemplate(ctx),
      conversation: renderConversation(ctx.conversation),
      processState: serializeProcessState(ctx),
      prefs: serializePrefs(ctx),
      evidence: renderEvidence(ctx),
      plan: renderPlan(ctx),
      userMessage: `${ctx.userMessage || ""}`.trim(),
    };

    const originalPrompt = this.assemblePrompt({
      targetLanguage,
      genre,
      templateTitle,
      noInfoToken,
      constraints,
      templateSections: rawSections.templateSections,
      conversation: rawSections.conversation,
      processState: rawSections.processState,
      prefs: rawSections.prefs,
      evidence: rawSections.evidence,
      plan: rawSections.plan,
      userMessage: rawSections.userMessage,
      mode: ctx.mode,
      intentType: ctx.intent?.type || "geral",
      intentConfidence: Number(ctx.intent?.confidence || 0),
    });

    const sections = {
      templateSections: clipToLimit(rawSections.templateSections, caps.templateMaxChars, "template"),
      conversation: clipToLimit(rawSections.conversation, caps.conversationMaxChars, "conversa"),
      processState: clipToLimit(rawSections.processState, caps.processStateMaxChars, "estado do processo"),
      prefs: clipToLimit(rawSections.prefs, caps.prefsMaxChars, "preferencias"),
      evidence: clipToLimit(rawSections.evidence, caps.evidenceMaxChars, "evidencias"),
      plan: clipToLimit(rawSections.plan, caps.planMaxChars, "plano"),
      userMessage: clipToLimit(rawSections.userMessage, caps.userMessageMaxChars, "mensagem do usuario"),
    };

    let prompt = this.assemblePrompt({
      targetLanguage,
      genre,
      templateTitle,
      noInfoToken,
      constraints,
      templateSections: sections.templateSections.value,
      conversation: sections.conversation.value,
      processState: sections.processState.value,
      prefs: sections.prefs.value,
      evidence: sections.evidence.value,
      plan: sections.plan.value,
      userMessage: sections.userMessage.value,
      mode: ctx.mode,
      intentType: ctx.intent?.type || "geral",
      intentConfidence: Number(ctx.intent?.confidence || 0),
    });

    if (prompt.length > caps.totalMaxChars) {
      const shrinkPlan: Array<{ key: keyof typeof sections; min: number; ratio: number; label: string }> = [
        { key: "evidence", min: 500, ratio: 0.55, label: "evidencias" },
        { key: "conversation", min: 400, ratio: 0.55, label: "conversa" },
        { key: "processState", min: 320, ratio: 0.6, label: "estado do processo" },
        { key: "plan", min: 280, ratio: 0.6, label: "plano" },
        { key: "templateSections", min: 420, ratio: 0.65, label: "template" },
        { key: "prefs", min: 220, ratio: 0.65, label: "preferencias" },
        { key: "userMessage", min: 320, ratio: 0.7, label: "mensagem do usuario" },
      ];
      for (const step of shrinkPlan) {
        if (prompt.length <= caps.totalMaxChars) break;
        const current = sections[step.key].value;
        if (!current) continue;
        const nextLimit = Math.max(step.min, Math.trunc(current.length * step.ratio));
        sections[step.key] = clipToLimit(current, nextLimit, step.label);
        prompt = this.assemblePrompt({
          targetLanguage,
          genre,
          templateTitle,
          noInfoToken,
          constraints,
          templateSections: sections.templateSections.value,
          conversation: sections.conversation.value,
          processState: sections.processState.value,
          prefs: sections.prefs.value,
          evidence: sections.evidence.value,
          plan: sections.plan.value,
          userMessage: sections.userMessage.value,
          mode: ctx.mode,
          intentType: ctx.intent?.type || "geral",
          intentConfidence: Number(ctx.intent?.confidence || 0),
        });
      }
    }

    if (prompt.length > caps.totalMaxChars) {
      sections.templateSections = {
        value: "(template resumido por limite de contexto)",
        truncated: true,
      };
      sections.conversation = {
        value: "(conversa omitida por limite de contexto)",
        truncated: true,
      };
      sections.processState = {
        value: "{}",
        truncated: true,
      };
      sections.prefs = {
        value: "{}",
        truncated: true,
      };
      sections.evidence = {
        value: "(evidencias resumidas por limite de contexto)",
        truncated: true,
      };
      sections.plan = {
        value: "- Resposta direta",
        truncated: true,
      };
      prompt = this.assemblePrompt({
        targetLanguage,
        genre,
        templateTitle,
        noInfoToken,
        constraints,
        templateSections: sections.templateSections.value,
        conversation: sections.conversation.value,
        processState: sections.processState.value,
        prefs: sections.prefs.value,
        evidence: sections.evidence.value,
        plan: sections.plan.value,
        userMessage: sections.userMessage.value,
        mode: ctx.mode,
        intentType: ctx.intent?.type || "geral",
        intentConfidence: Number(ctx.intent?.confidence || 0),
      });
    }

    let hardTruncated = false;
    if (prompt.length > caps.totalMaxChars) {
      prompt = clipToLimit(prompt, caps.totalMaxChars, "prompt consolidado").value;
      hardTruncated = true;
    }

    const audit: PromptBuildAudit = {
      caps,
      totalCharsBefore: originalPrompt.length,
      totalCharsAfter: prompt.length,
      hardTruncated,
      sections: [
        {
          name: "templateSections",
          originalChars: rawSections.templateSections.length,
          finalChars: sections.templateSections.value.length,
          truncated: sections.templateSections.truncated || sections.templateSections.value.length < rawSections.templateSections.length,
        },
        {
          name: "conversation",
          originalChars: rawSections.conversation.length,
          finalChars: sections.conversation.value.length,
          truncated: sections.conversation.truncated || sections.conversation.value.length < rawSections.conversation.length,
        },
        {
          name: "processState",
          originalChars: rawSections.processState.length,
          finalChars: sections.processState.value.length,
          truncated: sections.processState.truncated || sections.processState.value.length < rawSections.processState.length,
        },
        {
          name: "prefs",
          originalChars: rawSections.prefs.length,
          finalChars: sections.prefs.value.length,
          truncated: sections.prefs.truncated || sections.prefs.value.length < rawSections.prefs.length,
        },
        {
          name: "evidence",
          originalChars: rawSections.evidence.length,
          finalChars: sections.evidence.value.length,
          truncated: sections.evidence.truncated || sections.evidence.value.length < rawSections.evidence.length,
        },
        {
          name: "plan",
          originalChars: rawSections.plan.length,
          finalChars: sections.plan.value.length,
          truncated: sections.plan.truncated || sections.plan.value.length < rawSections.plan.length,
        },
        {
          name: "userMessage",
          originalChars: rawSections.userMessage.length,
          finalChars: sections.userMessage.value.length,
          truncated: sections.userMessage.truncated || sections.userMessage.value.length < rawSections.userMessage.length,
        },
      ],
    };

    return { prompt, audit };
  }

  async run(ctx: PipelineContext) {
    ctx.progress.stage = "compose";
    const targetLanguage = this.resolveTargetLanguage(ctx);
    const promptBuild = this.buildPromptFromContext(ctx);
    const consolidatedPrompt = promptBuild.prompt;
    const compactedSections = promptBuild.audit.sections.filter((item) => item.truncated).map((item) => item.name);
    if (compactedSections.length || promptBuild.audit.hardTruncated) {
      logger.warn("ASSISTANT_COMPOSE_PROMPT_COMPACTED", {
        requestId: ctx.requestId,
        totalCharsBefore: promptBuild.audit.totalCharsBefore,
        totalCharsAfter: promptBuild.audit.totalCharsAfter,
        capChars: promptBuild.audit.caps.totalMaxChars,
        compactedSections,
        hardTruncated: promptBuild.audit.hardTruncated,
      });
    }
    const queryInput = {
      ...ctx.ragInput,
      question: consolidatedPrompt,
      routingHint: ctx.userMessage,
      history: toRagHistory(ctx.conversation),
      requestId: ctx.requestId,
      preferredResponseLanguageId: targetLanguage,
    };
    if (ctx.stream) {
      const overrideMode = `${ctx.ragInput.pipelineModeOverride || ""}`.trim().toLowerCase();
      if (overrideMode === "lite" || overrideMode === "full") {
        ctx.ragRuntimeMode = overrideMode;
      }
      ctx.draftStream = await this.ragService.queryStream(queryInput);
      ctx.finalStream = ctx.draftStream;
      ctx.progress.composed = true;
      return;
    }

    const result = await this.ragService.query(queryInput);
    ctx.draftAnswer = result.answer;
    ctx.finalAnswer = result.answer;
    ctx.ragMetadata = result.metadata;
    const runtimeMode = `${result.metadata?.llm?.runtimeMode || ""}`.trim().toLowerCase();
    if (runtimeMode === "lite" || runtimeMode === "full") {
      ctx.ragRuntimeMode = runtimeMode;
    } else {
      const overrideMode = `${ctx.ragInput.pipelineModeOverride || ""}`.trim().toLowerCase();
      if (overrideMode === "lite" || overrideMode === "full") {
        ctx.ragRuntimeMode = overrideMode;
      }
    }
    ctx.progress.composed = true;
  }
}
