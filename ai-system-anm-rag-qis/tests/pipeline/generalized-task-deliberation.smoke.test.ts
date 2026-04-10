import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldGeneralizeDeliberationAcrossPromptFamilies(): Promise<void> {
  const prompts = [
    "Qual solucao escolho se preciso equilibrar custo, robustez e facilidade de manutencao?",
    "Defenda a melhor arquitetura e depois ataque a propria escolha com a critica mais forte.",
  ];

  for (const prompt of prompts) {
    const result = await runPipelineConductor({ rawMessage: prompt });
    const deliberative = result.state.generalTaskDeliberationState;

    assert(Boolean(deliberative?.isActive), "general task deliberation should activate");
    assert((deliberative?.taskArchetypes.length || 0) >= 1, "task archetypes should be mapped");
    assert((deliberative?.obligationGraph.length || 0) >= 1, "obligation graph should not be empty");
    assert(result.route === "inferential", "multi-demand prompt should route to inferential pipeline");
  }
}

void shouldGeneralizeDeliberationAcrossPromptFamilies();
