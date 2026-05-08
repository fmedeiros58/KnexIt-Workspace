/**
 * @file counterargument-intensity-calibrator.ts
 * @description Calibra intensidade de contra-argumentacao.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Ajustar contraponto ao pedido e reduzir overreach.
 * @inputs Modo dialetico e confianca da natureza cognitiva.
 * @outputs Intensidade numerica e etiqueta.
 * @dependsOn dialectical-mode-selector.
 * @usedBy operadores inferenciais e validadores dialogicos.
 * @invariants Intensidade alta requer modo strong_counterposition.
 * @notes A calibracao e deterministica e auditavel.
 */
import type { DialecticalMode } from "./dialectical-mode-selector";

export function calibrateCounterargumentIntensity(
  mode: DialecticalMode,
  confidence: number,
): { intensity: "none" | "low" | "medium" | "high"; score: number } {
  if (mode === "none") return { intensity: "none", score: 0 };
  if (mode === "soft_challenge") return { intensity: "low", score: Math.min(0.45, confidence) };
  if (mode === "balanced_counterposition") return { intensity: "medium", score: Math.min(0.72, Math.max(0.48, confidence)) };
  return { intensity: "high", score: Math.min(0.92, Math.max(0.68, confidence)) };
}

