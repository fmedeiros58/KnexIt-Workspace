import { segmentText } from "./segmenter";
import { semanticDeduper } from "./semantic-deduper";
import { fragmentMerger } from "./fragment-merger";
import { discourseRebuilder } from "./discourse-rebuilder";

export function enforceStructure(text: string): string {
  if (!text.trim()) return "";

  let segments = segmentText(text);
  segments = semanticDeduper(segments);
  segments = fragmentMerger(segments);

  return discourseRebuilder(segments);
}
