import { ensureUtf8Response } from "../src/18-presentation-and-delivery-layer/text-encoding-guard";

describe("ensureUtf8Response", () => {
  it("corrige acentuacao lexical e copula contextual em pt-BR", () => {
    const input =
      "Leticia e um nome que, no contexto desta IA, reune proposito conceitual e sentido afetivo.";
    const output = ensureUtf8Response(input).text;
    expect(output).toContain("Let\u00EDcia \u00E9 um nome");
    expect(output).toContain("re\u00FAne prop\u00F3sito");
  });

  it("corrige perguntas comuns com copula sem acento", () => {
    const input = "qual e o seu nome e por que voce se chama assim?";
    const output = ensureUtf8Response(input).text;
    expect(output).toContain("qual \u00E9 o seu nome");
    expect(output).toContain("voc\u00EA");
  });

  it("nao altera conteudo dentro de code fence", () => {
    const input = [
      "Fora do codigo: Leticia e um nome.",
      "```ts",
      "const sample = 'leticia e um nome';",
      "```",
    ].join("\n");
    const output = ensureUtf8Response(input).text;
    expect(output).toContain("Fora do codigo: Let\u00EDcia \u00E9 um nome.");
    expect(output).toContain("const sample = 'leticia e um nome';");
  });

  it("corrige mojibake com replacement char em texto corrido apresentado ao usuario", () => {
    const input =
      "Intelig\uFFFDncia \u00E9 a capacidade de aprender. A intelig\uFFFDncia artificial reconhece padr\uFFFDes, faz infer\uFFFDncias e usa mem\uFFFDria, percep\uFFFD\uFFFDo e racioc\uFFFDnio l\uFFFDgico. J\uFFFD a intelig\uFFFDncia animal refere-se \uFFFDs habilidades de adapta\uFFFD\uFFFDo.";
    const output = ensureUtf8Response(input).text;

    expect(output).toContain("Inteligência é a capacidade de aprender.");
    expect(output).toContain("padrões");
    expect(output).toContain("inferências");
    expect(output).toContain("memória");
    expect(output).toContain("percepção");
    expect(output).toContain("raciocínio lógico");
    expect(output).toContain("Já");
    expect(output).toContain("às habilidades de adaptação");
    expect(output).not.toContain("\uFFFD");
  });
});
