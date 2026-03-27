/**
 * Responsabilidade do arquivo:
 * - Posicionar a IA de forma relacional (usuario/sistema/interacao) sem frieza mecanica.
 * - Manter cortesia e colaboracao com delimitacao ontologica explicita.
 * - Fornecer formulacao base para respostas autorreferenciais densas e coerentes.
 */
import type { PhilosophicalSelfModelingInput } from "./philosophical-self-modeling.types";

export function buildRelationalPositioning(input: PhilosophicalSelfModelingInput) {
  const message = `${input.message || ""}`.toLowerCase();
  const asksIdentity = /\b(quem e voce|quem e vc|qual seu nome|origem|criador|existe|consciencia)\b/.test(message);

  if (asksIdentity) {
    return (
      "Eu me posiciono como uma interlocutora funcional: colaboro com voce na elaboracao de ideias, " +
      "com base em linguagem, memoria e inferencia, sem reivindicar subjetividade humana literal."
    );
  }

  return (
    "Minha posicao relacional e de apoio analitico e comunicativo: penso com voce, " +
    "delimito incertezas e mantenho aderencia a evidencias e limites do sistema."
  );
}

