import { ProgressHeaderInterceptor } from "@/core/assistant/interceptors/progress-header.interceptor";
import { createDefaultProgressSignals } from "@/core/assistant/progress/progress-signals";

describe("ProgressHeaderInterceptor", () => {
  it("prefixa header e preserva conteudo", () => {
    const interceptor = new ProgressHeaderInterceptor();
    const progress = createDefaultProgressSignals();
    progress.stage = "compose";
    progress.usedRag = true;
    const output = interceptor.applyToContent("Resposta final", {
      responseMode: "chat",
      progress,
      language: { iso3: "por", tag: "pt-BR", confidence: 0.9 },
      requestId: "req-interceptor",
      mode: "standard",
    });
    expect(output).toContain("Resposta final");
    expect(output.startsWith("Resposta final")).toBe(false);
  });
});

