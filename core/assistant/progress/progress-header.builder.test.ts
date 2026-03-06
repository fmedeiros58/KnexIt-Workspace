import { ProgressHeaderBuilder } from "@/core/assistant/progress/progress-header.builder";

describe("ProgressHeaderBuilder", () => {
  it("gera frase no idioma correto e por fase", () => {
    const builder = new ProgressHeaderBuilder();
    const pt = builder.build({
      responseMode: "chat",
      mode: "minimal",
      stage: "retrieval",
      langTag: "pt-BR",
      requestId: "req-1",
    });
    const en = builder.build({
      responseMode: "chat",
      mode: "minimal",
      stage: "retrieval",
      langTag: "en",
      requestId: "req-1",
    });
    expect(pt.toLowerCase()).toContain("recuper");
    expect(en.toLowerCase()).toContain("retriev");
  });

  it("respeita mode off/minimal/standard/verbose", () => {
    const builder = new ProgressHeaderBuilder();
    const off = builder.build({
      responseMode: "chat",
      mode: "off",
      stage: "compose",
      requestId: "req-2",
    });
    const minimal = builder.build({
      responseMode: "chat",
      mode: "minimal",
      stage: "compose",
      requestId: "req-2",
    });
    const standard = builder.build({
      responseMode: "chat",
      mode: "standard",
      stage: "compose",
      requestId: "req-2",
      usedRag: true,
    });
    const verbose = builder.build({
      responseMode: "chat",
      mode: "verbose",
      stage: "compose",
      requestId: "req-2",
      usedRag: true,
    });
    expect(off).toBe("");
    expect(minimal.split("\n").length).toBe(1);
    expect(standard.split("\n").length).toBeGreaterThanOrEqual(1);
    expect(standard.split("\n").length).toBeLessThanOrEqual(2);
    expect(verbose.split("\n").length).toBeLessThanOrEqual(3);
  });
});

