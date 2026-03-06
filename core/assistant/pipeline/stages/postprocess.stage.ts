import { OutlineGuardService } from "@/core/assistant/anti_redundancy/outline-guard.service";
import { RedundancyFilterService } from "@/core/assistant/anti_redundancy/redundancy-filter.service";
import { GenericStructureEnforcer } from "@/core/assistant/postprocess/generic-structure.enforcer";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { toRagHistory } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";
import type { RagQueryService } from "@/core/rag/rag-query-service";

const CTA_MIN_CHARS = 120;
const DEFAULT_REPAIR_PASSES = 1;

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

    const nextStepCta = buildNextStepCta(ctx, finalText);
    ctx.finalAnswer = nextStepCta ? `${finalText}\n\n${nextStepCta}` : finalText;
    ctx.progress.filteredRedundancy = true;
  }
}
