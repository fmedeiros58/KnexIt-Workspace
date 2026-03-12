import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";

export class PlanStage implements Stage {
  async run(ctx: PipelineContext) {
    ctx.progress.stage = "plan";
    if (ctx.mode === "chat") {
      ctx.plan = {
        sections: [
          {
            title: "Resposta direta",
            bullets: ["responder o pedido atual sem metalinguagem", "manter continuidade com o contexto ativo"],
          },
        ],
      };
      ctx.progress.planned = true;
      return;
    }

    if (ctx.templateSpec?.sections?.length) {
      ctx.plan = {
        sections: ctx.templateSpec.sections.map((section) => {
          const bullets = [
            section.required ? "item obrigatorio" : "item opcional",
            `maximo ${section.maxParagraphs} paragrafos`,
          ];
          if (ctx.templateSpec?.rules?.noInvention) bullets.push("nao inventar dados");
          return {
            title: section.title,
            bullets,
          };
        }),
      };
      ctx.progress.planned = true;
      return;
    }

    const intentType = ctx.intent?.type || "general";
    if (intentType === "summary") {
      ctx.plan = {
        sections: [
          { title: "Sintese principal", bullets: ["pontos centrais", "resultado objetivo"] },
          { title: "Fechamento", bullets: ["implicacao pratica"] },
        ],
      };
    } else if (intentType === "analysis") {
      ctx.plan = {
        sections: [
          { title: "Contexto", bullets: ["tema", "escopo"] },
          { title: "Analise", bullets: ["evidencias", "interpretacao"] },
          { title: "Conclusao", bullets: ["sintese", "proximos passos"] },
        ],
      };
    } else {
      ctx.plan = {
        sections: [
          { title: "Resposta direta", bullets: ["atender pedido"] },
          { title: "Aprofundamento", bullets: ["detalhes relevantes"] },
        ],
      };
    }
    ctx.progress.planned = true;
  }
}
