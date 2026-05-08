/**
 * @file dialectical-mode-selector.ts
 * @description Seleciona modo dialogico local a partir da politica de discordancia.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Informar operadores intracamada sobre tensao dialogica esperada.
 * @inputs DisagreementPolicy.
 * @outputs Modo dialetico compacto.
 * @dependsOn disagreement-policy-resolver.
 * @usedBy futuras integracoes de conversa e validacao.
 * @invariants Modo dialetico nao substitui LayerMode.
 * @notes Fornece semantica especifica para dialogo, mantendo a matriz como fonte de intensidade.
 */
import type { DisagreementPolicy } from "./disagreement-policy-resolver";

export type DialecticalMode = "none" | "soft_challenge" | "balanced_counterposition" | "strong_counterposition";

export function selectDialecticalMode(policy: DisagreementPolicy): DialecticalMode {
  if (!policy.allowCounterposition) return "none";
  if (policy.requireCounterposition && policy.maxIntensity === "high") return "strong_counterposition";
  if (policy.requireCounterposition) return "balanced_counterposition";
  return "soft_challenge";
}

