import { describe, expect, it } from "@jest/globals";
import { extractTextFromDocument } from "./text-extractor";

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

  it("extrai texto quando mime vem generico mas o conteudo e textual", async () => {
    const result = await extractTextFromDocument({
      bytes: Buffer.from("conteudo tecnico sem extensao", "utf8"),
      fileName: "sem-extensao",
      mimeType: "application/octet-stream",
    });

    expect(result.parser).toBe("utf8");
    expect(result.text).toContain("conteudo tecnico");
    expect(result.textQuality).toBe("native");
  });

  it("normaliza html para texto legivel", async () => {
    const result = await extractTextFromDocument({
      bytes: Buffer.from("<h1>Titulo</h1><p>Texto &amp; dados</p>", "utf8"),
      fileName: "pagina.html",
      mimeType: "text/html",
    });

    expect(result.parser).toBe("utf8");
    expect(result.text).toContain("Titulo");
    expect(result.text).toContain("Texto & dados");
  });

  it("mantem fallback seguro para imagem quando OCR estiver desabilitado", async () => {
    const prev = process.env.OCR_AUTO_ENABLED;
    process.env.OCR_AUTO_ENABLED = "0";

    try {
      const result = await extractTextFromDocument({
        bytes: Buffer.from([71, 73, 70, 56, 57, 97, 1, 0, 1, 0]),
        fileName: "imagem.gif",
        mimeType: "image/gif",
      });

      expect(result.parser).toBe("utf8");
      expect(result.textQuality).toBe("placeholder");
      expect(result.text).toContain("Arquivo anexado: imagem.gif.");
    } finally {
      if (typeof prev === "undefined") {
        delete process.env.OCR_AUTO_ENABLED;
      } else {
        process.env.OCR_AUTO_ENABLED = prev;
      }
    }
  });

  it("nao bloqueia ingestao quando OCR de imagem demora e retorna fallback controlado", async () => {
    const prevEnabled = process.env.OCR_AUTO_ENABLED;
    const prevTimeout = process.env.OCR_TIMEOUT_MS;
    const prevWorkerInitTimeout = process.env.OCR_WORKER_INIT_TIMEOUT_MS;
    const prevWorkerTerminateTimeout = process.env.OCR_WORKER_TERMINATE_TIMEOUT_MS;

    process.env.OCR_AUTO_ENABLED = "1";
    process.env.OCR_TIMEOUT_MS = "2500";
    process.env.OCR_WORKER_INIT_TIMEOUT_MS = "2500";
    process.env.OCR_WORKER_TERMINATE_TIMEOUT_MS = "1000";

    try {
      const { createCanvas } = await import("@napi-rs/canvas");
      const canvas = createCanvas(420, 120);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 420, 120);
      ctx.fillStyle = "#111111";
      ctx.font = "28px Arial";
      ctx.fillText("OCR smoke", 20, 68);

      const pngBytes = canvas.toBuffer("image/png");
      const startedAt = Date.now();
      const result = await extractTextFromDocument({
        bytes: pngBytes,
        fileName: "tiny.png",
        mimeType: "image/png",
      });
      const elapsedMs = Date.now() - startedAt;

      expect(elapsedMs).toBeLessThan(12_000);
      expect(result.parser).toBe("utf8");
      expect(["ocr_fallback", "placeholder"]).toContain(result.textQuality);
    } finally {
      if (typeof prevEnabled === "undefined") {
        delete process.env.OCR_AUTO_ENABLED;
      } else {
        process.env.OCR_AUTO_ENABLED = prevEnabled;
      }

      if (typeof prevTimeout === "undefined") {
        delete process.env.OCR_TIMEOUT_MS;
      } else {
        process.env.OCR_TIMEOUT_MS = prevTimeout;
      }

      if (typeof prevWorkerInitTimeout === "undefined") {
        delete process.env.OCR_WORKER_INIT_TIMEOUT_MS;
      } else {
        process.env.OCR_WORKER_INIT_TIMEOUT_MS = prevWorkerInitTimeout;
      }

      if (typeof prevWorkerTerminateTimeout === "undefined") {
        delete process.env.OCR_WORKER_TERMINATE_TIMEOUT_MS;
      } else {
        process.env.OCR_WORKER_TERMINATE_TIMEOUT_MS = prevWorkerTerminateTimeout;
      }
    }
  });
});
