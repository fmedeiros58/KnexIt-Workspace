import {
  disambiguateSameAuthorSameYear,
  formatCitation,
  formatReference,
  parseManualInput,
  renderReference,
  sortBibliography,
} from "../index";
import type { BibliographicSource, ReferenceStyle } from "../index";

function makeBaseSource(overrides: Partial<BibliographicSource> = {}): BibliographicSource {
  return parseManualInput({
    id: "ref-1",
    type: "book",
    title: "Metodologia da pesquisa científica",
    subtitle: "métodos e técnicas aplicadas",
    authors: [{ givenNames: "Paulo", familyName: "Freire", role: "author" }],
    publicationDate: { year: "2002" },
    place: "São Paulo",
    publisher: "Paz e Terra",
    ...overrides,
  });
}

function expectWithStyle(source: BibliographicSource, style: ReferenceStyle): string {
  return formatReference(source, style);
}

describe("reference-engine formatters", () => {
  it("formats ABNT book", () => {
    const formatted = expectWithStyle(makeBaseSource(), "ABNT_NBR_6023_2018");
    expect(formatted).toContain("FREIRE");
    expect(formatted).toContain("São Paulo: Paz e Terra, 2002");
  });

  it("formats APA book", () => {
    const formatted = expectWithStyle(makeBaseSource(), "APA_7");
    expect(formatted).toContain("Freire, P.");
    expect(formatted).toContain("(2002)");
  });

  it("formats ABNT journal article", () => {
    const source = makeBaseSource({
      type: "journalArticle",
      title: "Aprendizagem e autonomia",
      containerTitle: "Revista Educação",
      volume: "12",
      issue: "3",
      pages: { start: "10", end: "20" },
      publicationDate: { year: "2021", month: "05" },
    });
    const formatted = expectWithStyle(source, "ABNT_NBR_6023_2018");
    expect(formatted).toContain("Revista Educação");
    expect(formatted).toContain("v. 12");
    expect(formatted).toContain("n. 3");
    expect(formatted).toContain("p. 10-20");
  });

  it("formats APA journal article", () => {
    const source = makeBaseSource({
      type: "journalArticle",
      title: "Aprendizagem e autonomia",
      containerTitle: "Journal of Education",
      volume: "12",
      issue: "3",
      pages: { start: "10", end: "20" },
      doi: "10.1000/xyz123",
      publicationDate: { year: "2021" },
    });
    const formatted = expectWithStyle(source, "APA_7");
    expect(formatted).toContain("Journal of Education");
    expect(formatted).toContain("12(3)");
    expect(formatted).toContain("10-20");
    expect(formatted).toContain("https://doi.org/10.1000/xyz123");
  });

  it("formats ABNT webpage", () => {
    const source = makeBaseSource({
      type: "webpage",
      containerTitle: "Portal UFAC",
      url: "https://ufac.br/pesquisa",
      accessDate: { day: "13", month: "05", year: "2026" },
      publicationDate: { year: "2026", month: "05", day: "13" },
    });
    const formatted = expectWithStyle(source, "ABNT_NBR_6023_2018");
    expect(formatted).toContain("Disponível em: https://ufac.br/pesquisa.");
    expect(formatted).toContain("Acesso em:");
  });

  it("formats APA webpage", () => {
    const source = makeBaseSource({
      type: "webpage",
      containerTitle: "Portal UFAC",
      url: "https://ufac.br/pesquisa",
      publicationDate: { year: "2026", month: "05", day: "13" },
    });
    const formatted = expectWithStyle(source, "APA_7");
    expect(formatted).toContain("Portal UFAC");
    expect(formatted).toContain("https://ufac.br/pesquisa");
  });

  it("formats ABNT thesis/dissertation", () => {
    const source = makeBaseSource({
      type: "dissertation",
      title: "Formação docente no Acre",
      publicationDate: { year: "2024" },
      academicWork: {
        workType: "dissertação",
        degree: "Mestrado",
        course: "Educação",
        institution: "UFAC",
        place: "Rio Branco",
      },
    });
    const formatted = expectWithStyle(source, "ABNT_NBR_6023_2018");
    expect(formatted).toContain("dissertação");
    expect(formatted).toContain("UFAC");
    expect(formatted).toContain("Rio Branco");
  });

  it("formats APA thesis/dissertation", () => {
    const source = makeBaseSource({
      type: "thesis",
      title: "Formação docente no Acre",
      publicationDate: { year: "2024" },
      repositoryName: "Repositório UFAC",
      url: "https://repositorio.ufac.br/tese-1",
      academicWork: {
        workType: "tese",
        institution: "UFAC",
      },
    });
    const formatted = expectWithStyle(source, "APA_7");
    expect(formatted).toContain("[tese, UFAC]");
    expect(formatted).toContain("Repositório UFAC");
  });

  it("handles missing author fallback", () => {
    const source = makeBaseSource({
      authors: [],
      title: "Título sem autor",
    });
    const formattedAbnt = expectWithStyle(source, "ABNT_NBR_6023_2018");
    const formattedApa = expectWithStyle(source, "APA_7");
    expect(formattedAbnt.toLowerCase()).toContain("título sem autor");
    expect(formattedApa).toContain("Título sem autor");
  });

  it("handles missing date fallback", () => {
    const source = makeBaseSource({
      publicationDate: undefined,
    });
    const formattedAbnt = expectWithStyle(source, "ABNT_NBR_6023_2018");
    const formattedApa = expectWithStyle(source, "APA_7");
    expect(formattedAbnt.toLowerCase()).toContain("s. d.");
    expect(formattedApa.toLowerCase()).toContain("(n.d.)");
  });

  it("prioritizes DOI over URL when DOI exists", () => {
    const source = makeBaseSource({
      type: "journalArticle",
      doi: "10.2000/teste",
      url: "https://example.org/artigo",
      containerTitle: "Periódico X",
      publicationDate: { year: "2022" },
    });
    const formatted = expectWithStyle(source, "ABNT_NBR_6023_2018");
    expect(formatted).toContain("DOI: 10.2000/teste.");
  });

  it("uses URL when DOI is absent", () => {
    const source = makeBaseSource({
      type: "journalArticle",
      doi: undefined,
      url: "https://example.org/artigo",
      containerTitle: "Periódico X",
      publicationDate: { year: "2022" },
    });
    const formatted = expectWithStyle(source, "ABNT_NBR_6023_2018");
    expect(formatted).toContain("Disponível em: https://example.org/artigo.");
  });

  it("formats multiple authors for citations", () => {
    const source = makeBaseSource({
      authors: [
        { givenNames: "Maria", familyName: "Silva", role: "author" },
        { givenNames: "João", familyName: "Souza", role: "author" },
        { givenNames: "Ana", familyName: "Lima", role: "author" },
        { givenNames: "Pedro", familyName: "Alves", role: "author" },
      ],
      publicationDate: { year: "2026" },
    });
    const abntCitation = formatCitation(source, {
      sourceId: source.id,
      style: "ABNT_NBR_6023_2018",
      mode: "parenthetical",
    });
    const apaCitation = formatCitation(source, {
      sourceId: source.id,
      style: "APA_7",
      mode: "narrative",
    });
    expect(abntCitation.citation).toContain("et al.");
    expect(apaCitation.citation).toContain("et al.");
  });

  it("supports organization author", () => {
    const source = makeBaseSource({
      authors: [],
      organizationAuthor: "Universidade Federal do Acre",
      publicationDate: { year: "2026" },
    });
    const formattedAbnt = expectWithStyle(source, "ABNT_NBR_6023_2018");
    const formattedApa = expectWithStyle(source, "APA_7");
    expect(formattedAbnt).toContain("UNIVERSIDADE FEDERAL DO ACRE");
    expect(formattedApa).toContain("Universidade Federal do Acre");
  });

  it("sorts bibliography alphabetically", () => {
    const a = makeBaseSource({
      id: "a",
      authors: [{ givenNames: "B", familyName: "Souza", role: "author" }],
      publicationDate: { year: "2023" },
    });
    const b = makeBaseSource({
      id: "b",
      authors: [{ givenNames: "A", familyName: "Almeida", role: "author" }],
      publicationDate: { year: "2022" },
    });
    const sorted = sortBibliography([a, b], "ABNT_NBR_6023_2018");
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });

  it("disambiguates same author and same year", () => {
    const a = makeBaseSource({
      id: "a",
      authors: [{ givenNames: "Paulo", familyName: "Freire", role: "author" }],
      publicationDate: { year: "2020" },
    });
    const b = makeBaseSource({
      id: "b",
      authors: [{ givenNames: "Paulo", familyName: "Freire", role: "author" }],
      publicationDate: { year: "2020" },
      title: "Outra obra",
    });
    const output = disambiguateSameAuthorSameYear([a, b]);
    expect(output[0].extra?.yearSuffix).toBeDefined();
    expect(output[1].extra?.yearSuffix).toBeDefined();
  });

  it("renders full output with warnings and confidence", () => {
    const output = renderReference(
      makeBaseSource({
        authors: [],
        publicationDate: undefined,
      }),
      "ABNT_NBR_6023_2018",
    );
    expect(output.formattedReference.length).toBeGreaterThan(0);
    expect(output.confidence).toBeDefined();
    expect(Array.isArray(output.warnings)).toBe(true);
  });
});
