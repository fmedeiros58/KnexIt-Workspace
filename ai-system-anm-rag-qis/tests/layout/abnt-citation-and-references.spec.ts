import { createInitialProcessingState } from "../../src/bridges/contracts/processing-state";
import { markdownSerializer } from "../../src/18-presentation-and-delivery-layer/output-serializer/markdown-serializer";
import { plainTextSerializer } from "../../src/18-presentation-and-delivery-layer/output-serializer/plain-text-serializer";
import {
  formatAbntInlineCitation,
  formatAbntReferenceEntry,
  formatAbntReferenceList,
  resolveCitationRequestContext,
} from "../../src/18-presentation-and-delivery-layer/textual-layout-engine";
import type { PresentationRenderModel } from "../../src/18-presentation-and-delivery-layer/presentation-contracts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

{
  const citation = formatAbntInlineCitation({ authors: ["Bruce McEwen"], year: "2020" });
  assert(citation === "(MCEWEN, 2020)", "single indirect citation should follow ABNT");
}

{
  const citation = formatAbntInlineCitation({ authors: ["Bruce McEwen", "George Akil"], year: "2020" });
  assert(citation === "(MCEWEN; AKIL, 2020)", "two-author indirect citation should follow ABNT");
}

{
  const citation = formatAbntInlineCitation({ authors: ["Sonia Lupien", "A B", "C D"], year: "2009" });
  assert(citation === "(LUPIEN *et al.*, 2009)", "three-plus authors should use italicized et al.");
}

{
  const citation = formatAbntInlineCitation({ authors: ["Stephen Porges"], year: "2007" }, { page: "118" });
  assert(citation === "(PORGES, 2007, p. 118)", "direct citation with known page should include p. x");
}

{
  const reference = formatAbntReferenceEntry({
    authors: ["Bruce McEwen"],
    title: "Titulo principal",
    subtitle: "subtitulo",
    place: "Sao Paulo",
    publisher: "Editora X",
    year: "2020",
    sourceType: "book",
  });

  assert(
    reference === "MCEWEN, Bruce. **Titulo principal**: subtitulo. Sao Paulo: Editora X, 2020.",
    "book reference should keep bold only on main title",
  );
}

{
  const reference = formatAbntReferenceEntry({
    authors: ["Bruce McEwen", "George Akil"],
    title: "Titulo principal",
    journal: "Revista Cientifica",
    place: "Manaus",
    volume: "5",
    issue: "2",
    pages: "10-20",
    year: "2020",
    sourceType: "article",
  });

  assert(/\*Revista Cientifica\*/.test(reference), "article reference should keep journal in italics");
  assert(/v\. 5,/.test(reference), "article reference should include volume");
  assert(/n\. 2,/.test(reference), "article reference should include issue");
  assert(/p\. 10-20,/.test(reference), "article reference should include pages when provided");
}

{
  const references = formatAbntReferenceList([
    {
      authors: ["Zeta Silva"],
      title: "Obra Z",
      place: "Rio Branco",
      publisher: "Editora Z",
      year: "2019",
      sourceType: "book",
    },
    {
      authors: ["Ana Costa"],
      title: "Obra A",
      place: "Manaus",
      publisher: "Editora A",
      year: "2018",
      sourceType: "book",
    },
  ]);

  assert(references.length === 2, "reference list should keep all unique entries");
  assert(references[0].startsWith("COSTA, Ana"), "reference list should be alphabetically sorted by first author surname");
  assert(references.every((line) => !/^\s*[-*\d]/.test(line)), "ABNT reference list should have no bullets or numbering");
}

{
  const state = createInitialProcessingState("cite conforme ABNT e liste as referencias em ABNT no final");
  const context = resolveCitationRequestContext(state);
  assert(context.citationStyle === "abnt", "ABNT request should set citationStyle=abnt");
  assert(context.referenceListStyle === "abnt", "ABNT request should set referenceListStyle=abnt");
  assert(context.requestedInlineCitation, "ABNT citation request should flag inline citation");
  assert(context.requestedReferenceList, "ABNT reference request should flag reference list");
}

const abntModel: PresentationRenderModel = {
  channel: "rest",
  format: "markdown",
  text: "Texto de base",
  bubble: {
    role: "assistant",
    text: "Analise em ABNT.",
    paragraphs: ["Analise em ABNT."],
    paragraphCount: 1,
    charCount: 16,
  },
  citations: [],
  referenceList: [],
  referenceEntries: [
    {
      authors: ["Bruce McEwen"],
      title: "Titulo principal",
      subtitle: "subtitulo",
      place: "Sao Paulo",
      publisher: "Editora X",
      year: "2020",
      sourceType: "book",
    },
    {
      authors: ["George Akil"],
      title: "Obra complementar",
      place: "Rio Branco",
      publisher: "Editora Y",
      year: "2018",
      sourceType: "book",
    },
  ],
  citationRequestContext: {
    citationStyle: "abnt",
    referenceListStyle: "abnt",
    isAcademicMode: true,
    requestedInlineCitation: true,
    requestedReferenceList: true,
  },
  codeBlocks: [],
  documents: [],
  media: [],
  confidence: {
    score: 0.8,
    band: "high",
    label: "Alta",
    qualityDecision: "accept",
  },
};

{
  const serialized = plainTextSerializer({ model: abntModel });
  assert(/Referencias/i.test(serialized.text), "plain serializer should emit ABNT reference section heading");
  const tail = serialized.text.split(/Referencias/i)[1] || "";
  assert(!/\n\s*[-*]\s+/.test(tail), "plain ABNT references should not use bullets");
}

{
  const serialized = markdownSerializer({ model: abntModel });
  assert(/### Referencias/i.test(serialized.text), "markdown serializer should emit ABNT reference section heading");
  const tail = serialized.text.split(/### Referencias/i)[1] || "";
  assert(!/\n\s*[-*]\s+/.test(tail), "markdown ABNT references should not use bullets");
  assert(!/\[[^\]]+\]\(https?:\/\//i.test(tail), "markdown ABNT references should avoid hyperlink list format");
}
