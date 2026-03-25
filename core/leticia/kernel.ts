import type { LeticiaIntent, LeticiaSituationalContext } from "./types";
import { buildLeticiaResponsePolicy } from "./persona/response-policy";
import { planLeticiaTurn } from "./dialogue/turn-planner";

function buildPersonalMemoryBlock(context: LeticiaSituationalContext) {
  const lines: string[] = [];
  if (context.person?.displayName) {
    lines.push(`Pessoa atual: ${context.person.displayName}`);
  }
  if (context.identity.someoneInFrame) {
    lines.push(`Presenca visual detectada: sim`);
    lines.push(`Identidade confirmada: ${context.identity.identityConfirmed ? "sim" : "nao"}`);
  }
  if (context.visual.sceneSummary) {
    lines.push(`Cena visual: ${context.visual.sceneSummary}`);
  }
  if (context.visual.currentInterlocutorDurationMs > 0) {
    lines.push(`Persistencia do interlocutor atual: ${Math.round(context.visual.currentInterlocutorDurationMs / 100) / 10}s`);
  }
  if (context.visual.interlocutorSwitched) {
    lines.push("Houve troca recente de interlocutor.");
  }
  if (context.visual.recentSceneEvents.length) {
    lines.push("Eventos visuais recentes:");
    for (const event of context.visual.recentSceneEvents.slice(0, 4)) {
      lines.push(`- ${event.summary || event.eventType}`);
    }
  }
  if (context.memory.length) {
    lines.push("Memorias pessoais relevantes:");
    for (const item of context.memory.slice(0, 5)) {
      lines.push(`- ${item.content}`);
    }
  }
  if (context.relationships.length) {
    lines.push("Relacoes conhecidas:");
    for (const relation of context.relationships.slice(0, 4)) {
      lines.push(`- ${relation.relationType}: ${relation.targetDisplayName}`);
    }
  }
  if (context.observations.length) {
    lines.push("Observacoes recentes:");
    for (const observation of context.observations.slice(0, 3)) {
      lines.push(`- ${observation}`);
    }
  }
  return lines.join("\n");
}

export function buildLeticiaKernelOutput(intent: LeticiaIntent, context: LeticiaSituationalContext, userPrompt: string) {
  const plan = planLeticiaTurn(intent);
  if (plan.directReply) {
    return {
      plan,
      enrichedPrompt: userPrompt,
    };
  }

  const contextBlock = buildPersonalMemoryBlock(context);
  const policyBlock = buildLeticiaResponsePolicy(plan.mode, context);
  const parts = [plan.promptPrefix, policyBlock];
  if (contextBlock) {
    parts.push("Contexto situacional util:");
    parts.push(contextBlock);
  }
  parts.push("Ultima fala do usuario:");
  parts.push(userPrompt.trim());

  return {
    plan,
    enrichedPrompt: parts.filter(Boolean).join("\n\n"),
  };
}
