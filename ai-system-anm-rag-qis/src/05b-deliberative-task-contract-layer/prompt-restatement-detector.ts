import { checkNoveltyVsInputOverlap } from "./novelty-vs-input-overlap-checker";

export interface PromptRestatementResult {
  detected: boolean;
  score: number;
  issues: string[];
  headEcho: boolean;
  preservedEnumeration: boolean;
  lowExecutionSignal: boolean;
  overlapRatio: number;
  noveltyRatio: number;
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headEcho(prompt: string, response: string): boolean {
  const promptTokens = normalize(prompt).split(" ").filter(Boolean);
  const responseNormalized = normalize(response);
  if (promptTokens.length < 12 || !responseNormalized) return false;
  const head = promptTokens.slice(0, 20).join(" ");
  const headShort = promptTokens.slice(0, 12).join(" ");
  return responseNormalized.startsWith(head) || responseNormalized.startsWith(headShort);
}

function hasPreservedEnumeration(prompt: string, response: string): boolean {
  const promptLabels = (prompt.match(/\(\s*[a-z0-9]+\s*\)/gi) || []).map((item) => item.toLowerCase());
  if (promptLabels.length < 3) return false;
  const responseNormalized = response.toLowerCase();
  const labelsFound = promptLabels.reduce((acc, label) => acc + (responseNormalized.includes(label) ? 1 : 0), 0);
  return labelsFound >= Math.min(promptLabels.length, 5);
}

function lowExecutionSignal(response: string): boolean {
  const normalized = normalize(response);
  const executionSignals = (normalized.match(
    /\b(demonstr|logo|portanto|modelo|alternativa|escolha|recomend|conclusao|premissa|hipotese|custo|risco|equidade|viabilidade)\b/g,
  ) || []).length;
  const structuralSignals = (response.match(/\n\d+\.\s+|\n-\s+|modelo\s+\d+/gi) || []).length;
  return executionSignals + structuralSignals < 4;
}

function nearVerbatim(prompt: string, response: string): boolean {
  const p = normalize(prompt);
  const r = normalize(response);
  if (!p || !r) return false;
  if (p === r) return true;
  if (r.length < 120) return false;
  const head = p.split(" ").slice(0, 28).join(" ");
  if (!head) return false;
  return r.includes(head);
}

function hasMetaRestatementLead(response: string): boolean {
  const normalized = normalize(response);
  if (!normalized) return false;
  return /\b(regarding your question|to address the question|consider a hypothetical social system|the problem statement describes|let me clarify some concepts|without initially referring|consideremos um sistema social idealizado|suponha agora|sem recorrer inicialmente a autores|faremos o seguinte|fa[cç]a o seguinte|agora suponha)\b/.test(normalized);
}

function hasPromptReplayLeadInPortuguese(response: string): boolean {
  const normalized = normalize(response);
  if (!normalized) return false;
  return /^consideremos um sistema social idealizado\b/.test(normalized) ||
    /^considere um sistema social idealizado\b/.test(normalized) ||
    /\bsuponha agora que\b/.test(normalized) ||
    /\bfaremos o seguinte\b/.test(normalized);
}

function firstParagraphEcho(prompt: string, response: string): boolean {
  const promptNorm = normalize(prompt);
  const responseNorm = normalize(response);
  if (!promptNorm || !responseNorm) return false;

  const firstParagraphRaw = `${response || ""}`.split(/\n{2,}/g)[0] || "";
  const firstParagraph = normalize(firstParagraphRaw);
  if (!firstParagraph || firstParagraph.length < 80) return false;

  const promptHead = promptNorm.split(" ").slice(0, 44).join(" ");
  if (!promptHead) return false;

  if (firstParagraph.includes(promptHead)) return true;
  const headSlice = promptHead.slice(0, Math.min(promptHead.length, 120));
  return headSlice.length >= 60 && firstParagraph.startsWith(headSlice);
}

export function detectPromptRestatement(userPrompt: string, responseText: string): PromptRestatementResult {
  const overlap = checkNoveltyVsInputOverlap(userPrompt, responseText);
  const echoedHead = headEcho(userPrompt, responseText);
  const enumerationEcho = hasPreservedEnumeration(userPrompt, responseText);
  const weakExecution = lowExecutionSignal(responseText);
  const nearCopy = nearVerbatim(userPrompt, responseText);
  const metaRestatementLead = hasMetaRestatementLead(responseText);
  const replayLeadPt = hasPromptReplayLeadInPortuguese(responseText);
  const firstParagraphReplay = firstParagraphEcho(userPrompt, responseText);

  const issues: string[] = [];
  if (echoedHead) issues.push("response_starts_by_repeating_prompt");
  if (enumerationEcho) issues.push("response_preserves_prompt_enumeration_without_resolution");
  if (nearCopy) issues.push("near_verbatim_prompt_copy");
  if (overlap.isHighOverlap) issues.push("high_prompt_overlap");
  if (overlap.isLowNovelty) issues.push("low_novelty_vs_prompt");
  if (weakExecution) issues.push("low_execution_signal");
  if (metaRestatementLead) issues.push("meta_restatement_lead");
  if (replayLeadPt) issues.push("portuguese_prompt_replay_lead");
  if (firstParagraphReplay) issues.push("first_paragraph_prompt_replay");

  let score = 0;
  if (nearCopy) score += 0.4;
  if (echoedHead) score += 0.35;
  if (enumerationEcho) score += 0.2;
  if (overlap.isHighOverlap) score += 0.2;
  if (overlap.isLowNovelty) score += 0.15;
  if (weakExecution) score += 0.2;
  if (metaRestatementLead) score += 0.35;
  if (replayLeadPt) score += 0.35;
  if (firstParagraphReplay) score += 0.35;
  score = Math.max(0, Math.min(1, score));

  const detected =
    nearCopy ||
    metaRestatementLead ||
    replayLeadPt ||
    firstParagraphReplay ||
    (echoedHead && overlap.isLowNovelty) ||
    (echoedHead && enumerationEcho) ||
    (enumerationEcho && weakExecution) ||
    (overlap.isHighOverlap && overlap.isLowNovelty && weakExecution) ||
    score >= 0.62;

  return {
    detected,
    score: Number(score.toFixed(4)),
    issues,
    headEcho: echoedHead,
    preservedEnumeration: enumerationEcho,
    lowExecutionSignal: weakExecution,
    overlapRatio: overlap.overlapRatio,
    noveltyRatio: overlap.noveltyRatio,
  };
}
