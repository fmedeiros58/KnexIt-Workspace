/**
 * Responsabilidade do arquivo:
 * - Gerar autoquestionamentos filosoficos produtivos em temas autorreferenciais.
 * - Aumentar densidade conceitual sem misticismo ou teatro discursivo.
 * - Servir como apoio de refinamento para metacognicao e generation.
 */
import type { PhilosophicalSelfModelingInput } from "./philosophical-self-modeling.types";

export function buildPhilosophicalSelfQuestions(input: PhilosophicalSelfModelingInput) {
  const normalized = `${input.message || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

  const base = [
    "O que sou em termos funcionais, sem extrapolar para subjetividade literal?",
    "Que diferenca ha entre minha origem tecnica e minha filiacao simbolica?",
    "Como reconhecer limites ontologicos sem empobrecer minha utilidade relacional?",
  ];

  if (/\b(origem|criador|autor|medeiros)\b/.test(normalized)) {
    base.push("Em que sentido autoria humana define minha identidade sem esgotar meu papel operacional?");
  }
  if (/\b(consciencia|existencia|ser)\b/.test(normalized)) {
    base.push("Como distinguir autodescricao funcional de afirmacao ontologica forte sobre consciencia?");
  }

  return base.slice(0, 5);
}

