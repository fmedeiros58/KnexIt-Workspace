/**
 * Responsabilidade do arquivo:
 * - Validar fallback factual para pergunta direta de governador por estado.
 * - Garantir extracao de nome e montagem de resposta objetiva com fonte.
 * - Cobrir pergunta contaminada por artefatos internos e entities HTML.
 */
import { buildFactualAnswerFallback } from "../src/14-reasoning-and-generation-layer/draft-generation-core/factual-answer-fallback";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const result = buildFactualAnswerFallback({
  question: "qual o nome do governador do acre",
  sources: [
    {
      title: "Noticia local",
      url: "https://exemplo.com/noticia",
      snippet: "O julgamento do governador do Acre, Gladson Cameli (PP), foi suspenso apos pedido de vista.",
      freshnessScore: 0.82,
    },
  ],
});

assert(Boolean(result), "expected factual fallback result");
assert(Boolean(result?.answer.includes("Gladson")), "expected extracted governor name in answer");

const contaminated = buildFactualAnswerFallback({
  question: "qual o nome do governador do acre\n\nPensou por 1s\nq-branch-1: 0.52 | evidencia-guia: ...",
  sources: [
    {
      title: "Portal oficial",
      url: "https://exemplo.com/governo",
      snippet: "O governador do Estado do Acre: Gladson Cameli.",
      freshnessScore: 0.9,
    },
    {
      title: "Fonte secundaria",
      url: "https://exemplo.com/nota",
      snippet: "O governador do Acre é Gladson Cameli.",
      freshnessScore: 0.72,
    },
  ],
});

assert(Boolean(contaminated), "expected fallback for contaminated question");
assert(Boolean(contaminated?.answer.includes("Gladson Cameli")), "expected clean extracted name");

const president = buildFactualAnswerFallback({
  question: "qual e o nome do presidente atual dos eua?",
  sources: [
    {
      title: "Lista de presidentes dos Estados Unidos",
      url: "https://exemplo.com/presidentes",
      snippet: "O presidente atual e Donald Trump, empossado em 20 de janeiro de 2025.",
      freshnessScore: 0.86,
    },
  ],
});

assert(Boolean(president), "expected factual fallback for president question");
assert(Boolean(president?.answer.includes("Donald Trump")), "expected extracted president name");

const presidentNoisy = buildFactualAnswerFallback({
  question: "qual o nome do presidente dos estados unidos?",
  sources: [
    {
      title: "Eleicao presidencial nos Estados Unidos em 2024",
      url: "https://exemplo.com/eleicao",
      snippet: "Trump, que ja havia servido como o 45. presidente dos Estados Unidos ate quatro anos.",
      freshnessScore: 0.7,
    },
    {
      title: "Lista de presidentes dos Estados Unidos",
      url: "https://exemplo.com/lista",
      snippet: "O presidente atual e Donald Trump, empossado no cargo em 20 de janeiro de 2025.",
      freshnessScore: 0.86,
    },
  ],
});

assert(Boolean(presidentNoisy), "expected fallback result for noisy president snippets");
assert(Boolean(presidentNoisy?.answer.includes("Donald Trump")), "expected valid person name over noisy phrase");

const presidentBrazil = buildFactualAnswerFallback({
  question: "pode me dizer o nome do presidente do brasil?",
  sources: [
    {
      title: "Pergunta e resposta",
      url: "https://exemplo.com/pergunta",
      snippet: "Resposta: O nome do presidente do Brasil é Luiz Inácio Lula da Silva. Ele está em seu terceiro mandato.",
      freshnessScore: 0.72,
    },
    {
      title: "Presidente do Brasil - Wikipedia",
      url: "https://pt.wikipedia.org/wiki/Presidente_do_Brasil",
      snippet: "Ao candidato eleito presidente do Brasil é dado o título de presidente eleito.",
      freshnessScore: 0.74,
    },
  ],
});

assert(Boolean(presidentBrazil), "expected factual fallback for president do brasil");
assert(Boolean(presidentBrazil?.answer.includes("Luiz Inácio Lula da Silva")), "expected extracted Lula name");

const mayor = buildFactualAnswerFallback({
  question: "qual o nome do prefeito de rio branco?",
  sources: [
    {
      title: "Prefeitura de Rio Branco",
      url: "https://exemplo.com/rio-branco",
      snippet: "O prefeito de Rio Branco e Tiao Bocalom.",
      freshnessScore: 0.82,
    },
  ],
});

assert(Boolean(mayor), "expected factual fallback for mayor question");
assert(Boolean(mayor?.answer.includes("Bocalom")), "expected extracted mayor name");

// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
