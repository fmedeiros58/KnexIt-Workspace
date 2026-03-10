import { extractTextFromDocument } from "@/core/rag/text-extractor";

describe("extractTextFromDocument", () => {
  it("mantem fallback para formatos binarios nao suportados sem quebrar ingestao", async () => {
    const payload = Buffer.from([0, 159, 146, 150, 255, 10, 30, 40]);
    const result = await extractTextFromDocument({
      bytes: payload,
      fileName: "foto.heic",
      mimeType: "image/heic",
    });

    expect(result.parser).toBe("utf8");
    expect(result.mimeType).toBe("image/heic");
    expect(result.text).toContain("Arquivo anexado: foto.heic.");
    expect(result.text).toContain("Formato sem extracao textual nativa");
  });

  it("continua extraindo texto utf8 em tipos textuais", async () => {
    const result = await extractTextFromDocument({
      bytes: Buffer.from("linha 1\nlinha 2", "utf8"),
      fileName: "notas.txt",
      mimeType: "text/plain",
    });

    expect(result.parser).toBe("utf8");
    expect(result.text).toBe("linha 1\nlinha 2");
  });
});
