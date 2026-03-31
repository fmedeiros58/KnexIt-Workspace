import { textNormalizationService } from "../src/shared/text-processing/text-normalization.service";

describe("TextNormalizationService abbreviations", () => {
  it("expande abreviacoes comuns para forma canonica", () => {
    const normalized = textNormalizationService.canonical(
      "pq vc nsei? tbm qdo qria saber blz obg",
      "intent",
    );
    expect(normalized).toContain("porque");
    expect(normalized).toContain("voce");
    expect(normalized).toContain("nao sei");
    expect(normalized).toContain("tambem");
    expect(normalized).toContain("quando");
    expect(normalized).toContain("quero");
    expect(normalized).toContain("saber");
    expect(normalized).toContain("beleza");
    expect(normalized).toContain("obrigado");
  });

  it("mantem retrieval sem expandir agressivamente", () => {
    const retrieval = textNormalizationService.canonical("API p/ SQL c/ join", "retrieval");
    expect(retrieval).toContain("p/");
    expect(retrieval).toContain("c/");
  });

  it("fingerprint reduz variacao de abreviacao", () => {
    const a = textNormalizationService.fingerprint("pq vc ta bem?");
    const b = textNormalizationService.fingerprint("porque voce esta bem?");
    expect(a).toBe(b);
  });
});

