import type { ConversationMessage } from "@/core/assistant/pipeline/pipeline-context";
import { ShortTermContextProvider } from "@/core/assistant/memory/short-term-context.provider";

function makeHistory(lines: string[]): ConversationMessage[] {
  return lines.map((content, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content,
  }));
}

describe("ShortTermContextProvider", () => {
  it("preserva recencia mesmo com baixa sobreposicao lexical", () => {
    const provider = new ShortTermContextProvider();
    const history = makeHistory([
      "turno 1",
      "turno 2",
      "turno 3",
      "turno 4",
      "turno 5",
      "turno 6",
      "turno 7",
      "turno 8",
      "turno 9",
      "turno 10",
    ]);

    const selected = provider.selectRelevantWindow(history, "assunto totalmente diferente", 4);
    expect(selected.map((item) => item.content)).toEqual(["turno 7", "turno 8", "turno 9", "turno 10"]);
  });

  it("mantem ancora documental fora da janela recente", () => {
    const provider = new ShortTermContextProvider();
    const history = makeHistory([
      "abertura",
      "contexto inicial",
      "arquivo anexado doc:77",
      "comentario 1",
      "comentario 2",
      "comentario 3",
      "comentario 4",
      "comentario 5",
      "comentario 6",
      "comentario 7",
      "comentario 8",
      "comentario 9",
    ]);

    const selected = provider.selectRelevantWindow(history, "faca a verificacao agora", 6);
    const contents = selected.map((item) => item.content);
    expect(contents).toContain("arquivo anexado doc:77");
    expect(contents).toContain("comentario 9");
  });

  it("combina relevancia com recencia sem ultrapassar maxItems", () => {
    const provider = new ShortTermContextProvider();
    const history = makeHistory([
      "introducao",
      "responsividade plastica cerebral segundo medeiros",
      "topico intermediario",
      "topico intermediario 2",
      "topico intermediario 3",
      "topico intermediario 4",
      "topico intermediario 5",
      "topico intermediario 6",
      "topico intermediario 7",
      "fechamento recente",
    ]);

    const selected = provider.selectRelevantWindow(history, "fale sobre responsividade plastica cerebral", 5);
    expect(selected.length).toBe(5);
    expect(selected.map((item) => item.content)).toContain("responsividade plastica cerebral segundo medeiros");
  });

  it("mantem ancora de identidade fora da janela recente", () => {
    const provider = new ShortTermContextProvider();
    const history = makeHistory([
      "oi",
      "ola, como posso ajudar?",
      "meu nome e medeiros, pode me chamar de medeiros",
      "combinado, vou te chamar de Medeiros",
      "vamos para outro assunto",
      "resposta intermediaria 1",
      "resposta intermediaria 2",
      "resposta intermediaria 3",
      "resposta intermediaria 4",
      "resposta intermediaria 5",
    ]);

    const selected = provider.selectRelevantWindow(history, "ainda lembra do meu nome?", 5);
    const contents = selected.map((item) => item.content);
    expect(contents).toContain("meu nome e medeiros, pode me chamar de medeiros");
  });
});
