/**
 * Responsabilidade do arquivo:
 * - Gerar tensoes conceituais produtivas (sem oposicao artificial).
 * - Formular perguntas dialogicas curtas para aprofundamento conjunto.
 * - Priorizar tensoes com maior poder explicativo para o problema.
 */
import type { ConceptDecomposition, DialogicalTension, IdeaSeed } from "./communicative-elaboration.types";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function makeTension(id: string, poleA: string, poleB: string, productiveQuestion: string, intensity: number): DialogicalTension {
  return { id, poleA, poleB, productiveQuestion, intensity: clamp01(intensity) };
}

export function buildDialogicalTensions(seed: IdeaSeed, decomposition: ConceptDecomposition): DialogicalTension[] {
  const tensions: DialogicalTension[] = [];

  if (decomposition.rootConcepts.length >= 2) {
    tensions.push(
      makeTension(
        "tension:scope-vs-depth",
        decomposition.rootConcepts[0],
        decomposition.rootConcepts[1],
        `Se priorizarmos ${decomposition.rootConcepts[0]}, o que perdemos em ${decomposition.rootConcepts[1]}?`,
        0.64,
      ),
    );
  }

  if (seed.userGoal === "analisar_criticamente" || seed.userGoal === "refinar") {
    tensions.push(
      makeTension(
        "tension:clareza-vs-completude",
        "clareza_expositiva",
        "completude_argumentativa",
        "Qual nivel de detalhe preserva rigor sem perder fluidez comunicativa?",
        0.58,
      ),
    );
  }

  tensions.push(
    makeTension(
      "tension:fato-vs-hipotese",
      "afirmacoes_fatuais",
      "hipoteses_explicativas",
      "Quais pontos podem ser tratados como fato e quais devem ficar no campo hipotetico?",
      0.62,
    ),
  );

  return tensions.slice(0, 4);
}

