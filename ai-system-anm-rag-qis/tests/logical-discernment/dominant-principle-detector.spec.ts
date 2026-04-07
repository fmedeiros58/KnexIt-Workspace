import { detectDominantPrinciple } from "../../src/cognition/logical-discernment/dominant-principle-detector";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const economyDetection = detectDominantPrinciple({
  message: "qual a melhor forma de gastar menos gasolina? o principio aqui e a economia",
  normalizedMessage: "qual a melhor forma de gastar menos gasolina? o principio aqui e a economia",
});
assert(economyDetection.dominantPrinciple === "economy", "economy principle should be detected");
assert(economyDetection.confidence > 0.5, "economy confidence should be meaningful");

const safetyDetection = detectDominantPrinciple({
  message: "qual a melhor forma de voltar para casa tarde da noite com mais seguranca?",
  normalizedMessage: "qual a melhor forma de voltar para casa tarde da noite com mais seguranca?",
});
assert(safetyDetection.dominantPrinciple === "safety", "safety principle should be detected");

const unknownDetection = detectDominantPrinciple({
  message: "oi, tudo bem?",
  normalizedMessage: "oi, tudo bem?",
});
assert(unknownDetection.dominantPrinciple === "unknown", "small talk should remain unknown");
