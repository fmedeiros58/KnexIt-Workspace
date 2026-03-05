import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { toRagHistory } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";
import type { RagQueryService } from "@/core/rag/rag-query-service";

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

export class ComposeStage implements Stage {
  constructor(private readonly ragService: RagQueryService) {}

  private resolveTargetLanguage(ctx: PipelineContext) {
    const explicit = `${ctx.ragInput.preferredResponseLanguageId || ""}`.trim();
    if (explicit) return explicit;
    const detected = `${ctx.language?.tag || ""}`.trim();
    if (detected) return detected;
    return process.env.ACADEMIC_DEFAULT_LANG || "pt-BR";
  }

  private buildPromptFromContext(ctx: PipelineContext) {
    const targetLanguage = this.resolveTargetLanguage(ctx);
    const conversation = renderConversation(ctx.conversation);
    const evidence = renderEvidence(ctx);
    const constraints = renderConstraints(ctx);
    const plan = renderPlan(ctx);
    const processState = serializeProcessState(ctx);
    const prefs = serializePrefs(ctx);
    const genre = `${ctx.genre || "GENERIC_ACADEMIC"}`;
    const templateTitle = `${ctx.templateSpec?.title || "Template academico generico"}`;
    const templateSections = renderTemplate(ctx);
    const noInfoToken = placeholderForMissingInfo(targetLanguage);

    return [
      "CONTRATO DE IDIOMA:",
      `- Responda SOMENTE em: ${targetLanguage}.`,
      "- Nao mude para outro idioma sem pedido explicito do usuario.",
      "- Se houver mistura de idiomas, use o idioma dominante da mensagem atual.",
      "",
      "CONTRATO DE GENERO ACADEMICO:",
      `- Gere no genero: ${genre}.`,
      `- Template selecionado: ${templateTitle}.`,
      "- Use os titulos de secao do template como estrutura principal da resposta.",
      `- Se faltar informacao em secao obrigatoria, escreva exatamente: "${noInfoToken}".`,
      "- Nao invente dados, referencias ou resultados nao sustentados por evidencia.",
      "",
      "CONTRATO DE ESPECIFICIDADE:",
      "- A resposta deve refletir diretamente a mensagem atual do usuario.",
      "- Considere a conversa relevante, o estado do processo e as evidencias recuperadas.",
      "- Evite respostas genericas e evite repetir paragrafos entre secoes.",
      "- Respeite todas as restricoes explicitas.",
      "",
      `MODO: ${ctx.mode}`,
      `INTENCAO: ${ctx.intent?.type || "geral"} (confianca=${Number(ctx.intent?.confidence || 0).toFixed(2)})`,
      `RESTRICOES: ${constraints}`,
      "",
      "TEMPLATE (SECOES E REGRAS):",
      templateSections,
      "",
      "CONVERSA RELEVANTE:",
      conversation || "(nenhuma)",
      "",
      "ESTADO DO PROCESSO:",
      processState,
      "",
      "PREFERENCIAS PERSISTENTES:",
      prefs,
      "",
      "EVIDENCIAS:",
      evidence || "(nenhuma)",
      "",
      "PLANO DE RESPOSTA:",
      plan,
      "",
      "MENSAGEM DO USUARIO:",
      ctx.userMessage,
      "",
      `Escreva agora a resposta final no idioma ${targetLanguage}, com foco direto no pedido e no template academico selecionado.`,
    ].join("\n");
  }

  async run(ctx: PipelineContext) {
    ctx.progress.stage = "compose";
    const targetLanguage = this.resolveTargetLanguage(ctx);
    const consolidatedPrompt = this.buildPromptFromContext(ctx);
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
