import { AcademicGenre } from "@/core/assistant/genre/academic-genre.types";
import { GenreDetectorService } from "@/core/assistant/genre/genre-detector.service";

describe("GenreDetectorService", () => {
  it("prioriza genero explicitamente solicitado", () => {
    const detector = new GenreDetectorService();
    const result = detector.detect({
      message: "Faca uma resenha critica desta obra e destaque as limitacoes.",
    });
    expect(result.genre).toBe(AcademicGenre.CRITICAL_REVIEW);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("detecta revisao sistematica por termos de metodo", () => {
    const detector = new GenreDetectorService();
    const result = detector.detect({
      message:
        "Organize uma revisao sistematica com PRISMA, bases de dados, string de busca e criterios de inclusao/exclusao.",
    });
    expect(result.genre).toBe(AcademicGenre.SYSTEMATIC_REVIEW);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("faz fallback para genero generico quando nao ha sinal forte", () => {
    const detector = new GenreDetectorService();
    const result = detector.detect({
      message: "Me explique o tema de forma clara.",
      intentType: "general",
    });
    expect(result.genre).toBe(AcademicGenre.GENERIC_ACADEMIC);
  });
});
