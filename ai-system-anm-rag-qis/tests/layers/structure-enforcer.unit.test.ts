import { enforceStructure } from "../../src/15-response-structure-engine/structure-enforcer";

function shouldRemoveInternalAndDeduplicate() {
  const output = enforceStructure(
    [
      "Status epistemico: unknown.",
      "Confianca estimada: 0%.",
      "Alem disso, Oi",
      "Alem disso, oi",
      "Base inferencial:",
      "teste curto",
      "mais um bloco",
    ].join("\n"),
  );

  if (/status epistemico/i.test(output)) {
    throw new Error("internal status line should be removed");
  }
  if (/confianca estimada/i.test(output)) {
    throw new Error("internal confidence line should be removed");
  }
  if (/base inferencial/i.test(output)) {
    throw new Error("internal inferential line should be removed");
  }
  if (!/Oi teste curto mais um bloco/i.test(output)) {
    throw new Error("fragments should be merged and deduplicated");
  }
}

function shouldRemoveHeadingAndPolishLongParagraph() {
  const output = enforceStructure(
    [
      "Analise",
      "este e um paragrafo longo de validacao sem pontuacao terminal para acionar o polimento final",
    ].join("\n"),
  );

  if (/^analise/i.test(output)) {
    throw new Error("heading should not appear in rebuilt discourse");
  }
  if (!output.endsWith(".")) {
    throw new Error("long paragraph should be polished with terminal punctuation");
  }
}

shouldRemoveInternalAndDeduplicate();
shouldRemoveHeadingAndPolishLongParagraph();

function shouldCleanEchoAndPipeNoise() {
  const output = enforceStructure(
    [
      "tudo bem?",
      "tudo bem? tudo bem? .",
      "tudo bem? tudo bem? | oi",
      "Pensou por 67ms",
      "meu nome e medeiros, pode passar a me chamar pelo meu nome agora?",
      "meu nome e medeiros, pode passar a me chamar pelo meu nome agora? meu nome e medeiros, pode passar a me chamar pelo meu nome agora? .",
      "meu nome e medeiros, pode passar a me chamar pelo meu nome agora? | tudo bem?",
    ].join("\n"),
  );

  if (/pensou por/i.test(output)) {
    throw new Error("thinking telemetry line should be removed");
  }
  if (/\|/.test(output)) {
    throw new Error("pipe noise should be removed");
  }
  if (/tudo bem\?\s+tudo bem\?/i.test(output)) {
    throw new Error("repeated question should be collapsed");
  }
  if (/meu nome e medeiros.*meu nome e medeiros/i.test(output)) {
    throw new Error("repeated long sentence should be collapsed");
  }
}

shouldCleanEchoAndPipeNoise();
