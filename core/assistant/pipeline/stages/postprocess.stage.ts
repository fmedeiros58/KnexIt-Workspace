import { OutlineGuardService } from "@/core/assistant/anti_redundancy/outline-guard.service";
import { RedundancyFilterService } from "@/core/assistant/anti_redundancy/redundancy-filter.service";
import { GenericStructureEnforcer } from "@/core/assistant/postprocess/generic-structure.enforcer";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { toRagHistory } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";
import { enforceResponseStructure } from "@/core/chat/perception/response-structure.enforcer";
import type { ConversationPerceptionState } from "@/core/chat/perception/types";
import type { RagQueryService } from "@/core/rag/rag-query-service";

const CTA_MIN_CHARS = 120;
const DEFAULT_REPAIR_PASSES = 1;
const STREAM_PREFIX_BUFFER_MAX_CHARS = 520;
const UTF8_MOJIBAKE_REPLACEMENTS: ReadonlyArray<[string, string]> = [
  ["\u00C3\u00A1", "\u00E1"],
  ["\u00C3\u00A0", "\u00E0"],
  ["\u00C3\u00A2", "\u00E2"],
  ["\u00C3\u00A3", "\u00E3"],
  ["\u00C3\u00A4", "\u00E4"],
  ["\u00C3\u00A9", "\u00E9"],
  ["\u00C3\u00AA", "\u00EA"],
  ["\u00C3\u00A8", "\u00E8"],
  ["\u00C3\u00AD", "\u00ED"],
  ["\u00C3\u00AC", "\u00EC"],
  ["\u00C3\u00B3", "\u00F3"],
  ["\u00C3\u00B4", "\u00F4"],
  ["\u00C3\u00B5", "\u00F5"],
  ["\u00C3\u00B6", "\u00F6"],
  ["\u00C3\u00BA", "\u00FA"],
  ["\u00C3\u00BC", "\u00FC"],
  ["\u00C3\u00A7", "\u00E7"],
  ["\u00C3\u0081", "\u00C1"],
  ["\u00C3\u0089", "\u00C9"],
  ["\u00C3\u008D", "\u00CD"],
  ["\u00C3\u0093", "\u00D3"],
  ["\u00C3\u009A", "\u00DA"],
  ["\u00C3\u0087", "\u00C7"],
  ["\u00E2\u0080\u0093", "-"],
  ["\u00E2\u0080\u0094", "-"],
  ["\u00E2\u0080\u0098", "'"],
  ["\u00E2\u0080\u0099", "'"],
  ["\u00E2\u0080\u009C", "\""],
  ["\u00E2\u0080\u009D", "\""],
  ["\u00E2\u0080\u00A6", "..."],
  ["\u00C2", ""],
];

const PT_DIACRITIC_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\bcognicao\b/g, "cognição"],
  [/\binteracao\b/g, "interação"],
  [/\bassistencia\b/g, "assistência"],
  [/\btecnica\b/g, "técnica"],
  [/\bvinculo\b/g, "vínculo"],
  [/\bdimensao\b/g, "dimensão"],
  [/\bformulacao\b/g, "formulação"],
  [/\bcomposicao\b/g, "composição"],
  [/\bdissertacao\b/g, "dissertação"],
  [/\bdedicatoria\b/g, "dedicatória"],
  [/\bprecisao\b/g, "precisão"],
  [/\binvencoes\b/g, "invenções"],
  [/\bmitologicas\b/g, "mitológicas"],
  [/\bnao\b/g, "não"],
  [/\binformacao\b/g, "informação"],
  [/\bverificacao\b/g, "verificação"],
  [/\bvoce\b/g, "você"],
  [/\bVoce\b/g, "Você"],
];

function shouldApplyPortugueseDiacriticRepair(value: string) {
  const normalized = `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return /\b(leticia|medeiros|language-engineered technology|cognicao|interacao|assistencia|arquitetura tecnica|vinculo humano)\b/.test(
    normalized,
  );
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveIntEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function hasNextStepCta(text: string) {
  const normalized = normalize(text);
  return (
    normalized.includes("se quiser, no proximo passo eu posso") ||
    normalized.includes("if you want, in the next step i can")
  );
}

function resolveLanguageFamily(ctx: PipelineContext) {
  const tag = `${ctx.language?.tag || ""}`.trim().toLowerCase();
  if (tag.startsWith("en")) return "en";
  return "pt";
}

function resolveNextStepAction(ctx: PipelineContext, languageFamily: "pt" | "en") {
  const intent = `${ctx.intent?.type || "general"}`.trim().toLowerCase();
  if (languageFamily === "en") {
    if (intent === "analysis") return "deepen the analysis on a specific axis";
    if (intent === "summary") return "expand the summary into structured topics with examples";
    if (intent === "planning") return "turn this into an execution plan with concrete steps";
    if (intent === "translation") return "deliver a bilingual version with terminology notes";
    return "refine the answer to the depth and tone you prefer";
  }
  if (intent === "analysis") return "aprofundar a analise em um eixo especifico";
  if (intent === "summary") return "expandir a sintese em topicos estruturados com exemplos";
  if (intent === "planning") return "transformar isso em um plano de execucao com etapas concretas";
  if (intent === "translation") return "entregar uma versao bilingue com notas de terminologia";
  return "refinar a resposta no nivel de detalhe e tom que voce preferir";
}

function buildNextStepCta(ctx: PipelineContext, text: string) {
  const ctaEnabled = parseBooleanEnv(process.env.ASSISTANT_APPEND_NEXT_STEP_CTA, false);
  if (!ctaEnabled) return "";
  const normalized = normalize(text);
  if (!normalized || normalized.length < CTA_MIN_CHARS) return "";
  if (ctx.mode !== "chat") return "";
  if (hasNextStepCta(normalized)) return "";
  if ((ctx.constraints || []).includes("sem_fuga_escopo")) return "";

  const languageFamily = resolveLanguageFamily(ctx);
  const action = resolveNextStepAction(ctx, languageFamily);
  if (languageFamily === "en") {
    return `If you want, in the next step I can ${action}.`;
  }
  return `Se quiser, no proximo passo eu posso ${action}.`;
}

function buildRepairPrompt(ctx: PipelineContext, repairPrompt: string, baseText: string) {
  const targetLanguage = `${ctx.language?.tag || process.env.ACADEMIC_DEFAULT_LANG || "pt-BR"}`.trim();
  const normalizedLanguage = targetLanguage.toLowerCase();
  if (normalizedLanguage.startsWith("en")) {
    return [
      "You are in repair mode for an academic text.",
      `Target language: ${targetLanguage}.`,
      "Respect all listed template constraints and do not invent information.",
      repairPrompt,
      "",
      "TEXT TO REPAIR:",
      baseText,
    ].join("\n");
  }
  return [
    "Você está no modo de reparo para texto acadêmico.",
    `Idioma alvo: ${targetLanguage}.`,
    "Respeite o template, remova redundâncias e não invente informações.",
    repairPrompt,
    "",
    "TEXTO PARA REPARO:",
    baseText,
  ].join("\n");
}

function normalizeFold(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return `${value || ""}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAnswerLabelPrefix(text: string) {
  let output = `${text || ""}`.trimStart();
  output = output.replace(/^\(*\s*(?:resposta|response|answer)\s*[:：-]\s*/i, "");
  output = output.replace(/^\)\s*/, "");
  output = output.replace(/^\s*(?:resposta|response|answer)\s*[:：-]\s*/i, "");
  return output;
}

function stripQuestionAnswerEnvelope(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized.startsWith("pergunta:") && !normalized.startsWith("question:")) return text;
  const answerMatch = text.match(/(?:resposta|answer|response)\s*[:：-]\s*/i);
  if (!answerMatch || answerMatch.index === undefined) return text;
  return text.slice(answerMatch.index + answerMatch[0].length).trimStart();
}

function stripEchoedUserMessage(text: string, userMessage: string) {
  const message = `${userMessage || ""}`.trim();
  if (!message || message.length > 180) return text;
  const escapedMessagePattern = escapeRegex(message).replace(/\s+/g, "\\s+");
  const patterns = [
    new RegExp(`^\\s*${escapedMessagePattern}\\s*(?:\\n+|[-–—:：]+\\s*|$)`, "i"),
    new RegExp(`^\\s*[\"'“”‘’]?${escapedMessagePattern}[\"'“”‘’]?\\s*(?:\\n+|[-–—:：]+\\s*|$)`, "i"),
  ];
  for (const pattern of patterns) {
    if (!pattern.test(text)) continue;
    return text.replace(pattern, "").trimStart();
  }
  return text;
}


function trimOuterParentheses(text: string) {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) return trimmed;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner || /[()]/.test(inner)) return trimmed;
  return inner;
}

function stripPersonaLabelPrefix(text: string) {
  let output = `${text || ""}`.trimStart();
  output = output.replace(/^\s*(?:leticia|l\.e\.t\.i\.c\.i\.a|assistente|assistant)\s*[:\-]\s*/i, "");
  output = output.replace(/^\s*["']?(?:leticia|l\.e\.t\.i\.c\.i\.a)["']?\s*[:\-]\s*/i, "");
  return output;
}

function isVerifiableCurrentQuestion(value: string) {
  const normalized = normalizeFold(value);
  if (!normalized) return false;
  const asksCurrentOffice =
    /\b(reitor|reitora|presidente|prefeito|governador|ministro|secretario|diretor|ceo|rector|chancellor)\b/.test(
      normalized,
    ) && /\b(quem|who|qual|nome|current|atual|hoje|agora)\b/.test(normalized);
  const asksVerifiableData =
    /\b(data|ano|numero|percentual|taxa|fonte|citacao|referencia|lei|norma|resolucao|preco|valor|dosagem|dose|mg|ml)\b/.test(
      normalized,
    );
  return asksCurrentOffice || asksVerifiableData;
}

function repairUtf8Mojibake(value: string) {
  let repaired = `${value || ""}`;
  for (const [from, to] of UTF8_MOJIBAKE_REPLACEMENTS) {
    if (!repaired.includes(from)) continue;
    repaired = repaired.split(from).join(to);
  }
  const mojibakeChanged = repaired !== `${value || ""}`;
  if (mojibakeChanged || shouldApplyPortugueseDiacriticRepair(repaired)) {
    for (const [pattern, replacement] of PT_DIACRITIC_REPLACEMENTS) {
      repaired = repaired.replace(pattern, replacement);
    }
  }
  return repaired;
}

function isAuthorYearGroundingQuestion(value: string) {
  const normalized = normalizeFold(value);
  if (!normalized) return false;
  const hasYear = /\b(19|20)\d{2}\b/.test(normalized);
  if (!hasYear) return false;
  const hasAcademicCue = /\b(dissertacao|tese|obra|artigo|paper|resenha|citacao|referencia)\b/.test(normalized);
  if (!hasAcademicCue) return false;
  const hasAuthorFrame =
    /\b(segundo|conforme|de acordo com|autor|autora)\b/.test(normalized) ||
    /\b(de|da|do)\s+[a-z][a-z.'\-\s]{1,80}\s*\((19|20)\d{2}\)/.test(normalized) ||
    /\b[a-z][a-z.'\-\s]{1,80}\s*\((19|20)\d{2}\)/.test(normalized);
  return hasAuthorFrame;
}

function hasScopedDocumentInput(ctx: PipelineContext) {
  if (ctx.ragInput.composerBound === true) return true;
  if (Number.isFinite(Number(ctx.ragInput.documentId)) && Number(ctx.ragInput.documentId) > 0) return true;
  if (Array.isArray(ctx.ragInput.documentIds) && ctx.ragInput.documentIds.some((row) => Number(row) > 0)) return true;
  if (Array.isArray(ctx.attachments) && ctx.attachments.length > 0) return true;
  return false;
}

function isDocumentGroundingRequest(userMessage: string) {
  const normalized = normalizeFold(userMessage);
  if (!normalized) return false;
  const asksAnalyticalTask =
    /\b(resenha|analise|analisar|resumo|sintese|critica|comente|explique|interprete|avali(e|ar)|desenvolva)\b/.test(
      normalized,
    ) || /\b(faca|faça)\b/.test(normalized);
  if (!asksAnalyticalTask) return false;
  const mentionsDocument =
    /\b(arquivo|documento|anexo|pdf|obra|dissertacao|tese|trabalho|texto|material)\b/.test(normalized) ||
    /\b(esse|essa|este|esta|desse|dessa|deste|em questao|em questao)\b/.test(normalized);
  return mentionsDocument;
}

function hasGroundedDocumentEvidence(ctx: PipelineContext) {
  const retrievalChunks = Number(ctx.ragMetadata?.retrieval?.returnedChunks || 0);
  const selectedChunks = Number(ctx.ragMetadata?.contextPack?.selectedChunks || 0);
  const fullDocChars = Number(ctx.ragMetadata?.fullDocumentRead?.includedChars || 0);
  if (retrievalChunks > 0 || selectedChunks > 0 || fullDocChars > 0) return true;
  return (ctx.evidence || []).some((row) => {
    const ref = `${row.ref || ""}`.trim().toLowerCase();
    const text = `${row.text || ""}`.trim();
    if (row.source !== "rag") return false;
    if (!/^doc:|^docscope:/.test(ref)) return false;
    if (text.length < 80) return false;
    if (/nao foi possivel recuperar trechos/i.test(text)) return false;
    if (/nao foi possivel consultar o conteudo/i.test(text)) return false;
    return true;
  });
}

function hasDocumentClarificationSignal(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  return (
    /\b(nao encontrei trechos suficientes do documento|nao consegui recuperar trechos|preciso de mais informacoes do arquivo)\b/.test(
      normalized,
    ) ||
    /\b(voce quer que eu (resuma|leia)|quer indicar paginas|trecho prioritario)\b/.test(normalized)
  );
}

function hasDocumentGroundedResponseSignal(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  return (
    /\b(com base no documento|de acordo com o documento|no documento anexado|no arquivo anexado)\b/.test(normalized) ||
    /\b(trecho(s)? do documento|trecho(s)? recuperado(s)?|obra anexada)\b/.test(normalized)
  );
}

type IdentityField = "nome_completo" | "idade" | "profissao";

function collectUserConversationText(ctx: PipelineContext) {
  const tail = (ctx.conversation || [])
    .filter((row) => row.role === "user")
    .slice(-6)
    .map((row) => `${row.content || ""}`.trim())
    .filter(Boolean)
    .join(" ");
  return `${tail} ${`${ctx.userMessage || ""}`.trim()}`.trim();
}

function extractMissingIdentityFields(text: string): IdentityField[] {
  const normalized = normalizeFold(text);
  if (!normalized) return [];

  const isInviteDraftRequest =
    /\b(escreva|redija|crie|faca|faça|monte|produza)\b/.test(normalized) &&
    /\b(convite|texto convite|mensagem|carta)\b/.test(normalized);
  if (!isInviteDraftRequest) return [];

  const asksFullName = /\b(nome completo)\b/.test(normalized);
  const asksAge = /\b(minha idade|idade)\b/.test(normalized);
  const asksProfession = /\b(minha profissao|profissao)\b/.test(normalized);

  const nameMatch = normalized.match(/\bmeu nome(?: completo)? (?:e|eh)\s+([a-z][a-z\s.'-]{0,120})/i);
  const providedNameTokens = nameMatch
    ? nameMatch[1]
        .trim()
        .split(/\s+/g)
        .filter(Boolean)
    : [];
  const hasFullName = providedNameTokens.length >= 2;

  const hasAge =
    /\b(?:tenho|minha idade (?:e|eh)|idade)\s*\d{1,3}\s*(?:anos?)?\b/.test(normalized) ||
    /\b\d{1,3}\s*anos\b/.test(normalized);

  const hasProfession =
    /\b(?:sou|minha profissao (?:e|eh)|trabalho como)\s+[a-z][a-z\s-]{1,80}\b/.test(normalized) &&
    !/\b(?:sou\s+medeiros)\b/.test(normalized);

  const missing: IdentityField[] = [];
  if (asksFullName && !hasFullName) missing.push("nome_completo");
  if (asksAge && !hasAge) missing.push("idade");
  if (asksProfession && !hasProfession) missing.push("profissao");
  return missing;
}

function hasIdentityClarificationSignal(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  return (
    /\b(para escrever|para montar|para redigir|me faltam dados|preciso de)\b/.test(normalized) &&
    /\b(nome completo|idade|profissao)\b/.test(normalized)
  );
}

function buildIdentityClarificationReply(ctx: PipelineContext, missing: IdentityField[]) {
  const languageFamily = resolveLanguageFamily(ctx);
  if (languageFamily === "en") {
    const labels = missing.map((field) => {
      if (field === "nome_completo") return "your full name";
      if (field === "idade") return "your age";
      return "your profession";
    });
    return `I can write this invitation, but I still need: ${labels.join(", ")}. If you want, also tell me your friend's name to personalize the opening.`;
  }
  const labels = missing.map((field) => {
    if (field === "nome_completo") return "seu nome completo";
    if (field === "idade") return "sua idade";
    return "sua profissao";
  });
  return `Perfeito. Para eu escrever esse convite exatamente como voce pediu, ainda preciso de ${labels.join(", ")}. Se quiser, tambem me diga o nome do seu amigo para personalizar a abertura.`;
}

function enforceIdentityClarificationGuard(ctx: PipelineContext, text: string) {
  const missing = extractMissingIdentityFields(collectUserConversationText(ctx));
  if (!missing.length) return text;
  if (hasIdentityClarificationSignal(text)) return text;
  return buildIdentityClarificationReply(ctx, missing);
}

function buildMissingDocumentGroundingReply(ctx: PipelineContext) {
  const languageFamily = resolveLanguageFamily(ctx);
  if (languageFamily === "en") {
    return "I can do this analysis, but I still do not have enough grounded excerpts from the attached file. Do you want me to read the full document now, or should I focus on specific pages/sections?";
  }
  return "Posso fazer essa análise, mas ainda não tenho trechos suficientes do arquivo anexado para responder com precisão. Você quer que eu leia o documento inteiro agora, ou prefere indicar páginas/trechos prioritários?";
}

function enforceDocumentGroundingClarification(ctx: PipelineContext, text: string) {
  if (!hasScopedDocumentInput(ctx)) return text;
  if (!isDocumentGroundingRequest(ctx.userMessage)) return text;
  if (hasDocumentGroundedResponseSignal(text)) return text;
  if (hasGroundedDocumentEvidence(ctx)) return text;
  if (hasDocumentClarificationSignal(text)) return text;
  return buildMissingDocumentGroundingReply(ctx);
}

function hasPositiveWebEvidence(ctx: PipelineContext) {
  return (ctx.evidence || []).some((row) => {
    const ref = `${row.ref || ""}`.trim().toLowerCase();
    const text = `${row.text || ""}`.trim();
    if (ref === "web:missing") return false;
    if (ref.startsWith("web:")) return true;
    return /\[web\]/i.test(text) && !/\[web_required\]/i.test(text);
  });
}

function hasWebVerificationFailureSignal(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  return (
    /\b(nao consegui validar|verificacao web falhou|preciso verificar|sem base verificavel)\b/.test(normalized) ||
    /\b(cannot verify|web verification failed|insufficient evidence|need to verify)\b/.test(normalized)
  );
}

function hasPersonaPolicyLeak(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  return (
    /\b(i won t reveal internal processes|responding professionally and objectively|inside knexit)\b/.test(normalized) ||
    /\b(nao vou revelar processos internos|ia nativa do ecossistema|respondo com naturalidade objetividade)\b/.test(
      normalized,
    ) ||
    /\b(assistente interno|plataforma knexit|nao sou leticia|nao exponho processos internos)\b/.test(normalized) ||
    /\b(respondo como uma pessoa util e profissional|se houver saudacao|nao uso observacoes|comentarios sobre regras e diretrizes)\b/.test(
      normalized,
    )
  );
}

function buildMissingWebVerificationReply(ctx: PipelineContext) {
  const languageFamily = resolveLanguageFamily(ctx);
  if (languageFamily === "en") {
    return "I could not validate this fact with web sources in this turn. To avoid outdated information, I need to rerun multi-source verification before confirming it.";
  }
  return "Não consegui validar esse fato em fontes web neste turno. Para evitar informação desatualizada, preciso repetir a verificação multifonte antes de confirmar.";
}

function buildMissingAuthorYearGroundingReply(ctx: PipelineContext) {
  const languageFamily = resolveLanguageFamily(ctx);
  if (languageFamily === "en") {
    return "I could not validate this author-year reference with grounded sources in this turn. Send the source document, excerpt, or reliable link so I can answer with traceable support.";
  }
  return "Não consegui validar esta referência autor-ano com fontes ancoradas neste turno. Envie o documento, trecho ou link confiável para eu responder com lastro verificável.";
}

function enforceVerifiableWebGuard(ctx: PipelineContext, text: string) {
  const forceMultiSource = parseBooleanEnv(process.env.KNEXAI_FORCE_MULTI_SOURCE_WEB_SEARCH, true);
  if (!forceMultiSource) return text;
  if (isAuthorYearGroundingQuestion(ctx.userMessage)) {
    if (hasScopedDocumentInput(ctx)) return text;
    if (hasPositiveWebEvidence(ctx)) return text;
    return buildMissingAuthorYearGroundingReply(ctx);
  }
  if (!isVerifiableCurrentQuestion(ctx.userMessage)) return text;
  if (hasScopedDocumentInput(ctx)) return text;
  if (hasPersonaPolicyLeak(text)) return buildMissingWebVerificationReply(ctx);
  if (hasPositiveWebEvidence(ctx)) return text;
  if (hasWebVerificationFailureSignal(text)) return text;
  return buildMissingWebVerificationReply(ctx);
}

function stripLeadingGreetingForVerifiableQuestion(text: string, userMessage: string) {
  if (!isVerifiableCurrentQuestion(userMessage)) return text;
  let output = `${text || ""}`.trimStart();
  output = output.replace(/^\s*(?:oi|ola|olá|bom dia|boa tarde|boa noite)[^.!?]*[.!?]\s*/i, "");
  output = output.replace(/^\s*(?:usuario|usuário|user)\s*[,:\-]\s*/i, "");
  return output;
}

function foldLoose(value: string) {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingAnswerWrapper(text: string) {
  let output = `${text || ""}`.trim();
  const pattern =
    /[\(\[]\s*(?:resposta|response|answer)(?:\s+em\s+(?:portugues|portugu[e?]s|english|ingles|espanol|espa?ol)(?:\s+brasileiro)?)?\s*[:\-]\s*([\s\S]*?)\s*[\)\]]\s*$/i;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const match = output.match(pattern);
    if (!match || match.index === undefined) break;
    const prefix = output.slice(0, match.index).trim();
    const inner = `${match[1] || ""}`.trim();
    if (!inner) {
      output = prefix;
      continue;
    }
    if (!prefix) {
      output = inner;
      continue;
    }
    const foldedPrefix = foldLoose(prefix);
    const foldedInner = foldLoose(inner);
    if (
      foldedPrefix &&
      foldedInner &&
      (foldedPrefix === foldedInner || foldedPrefix.endsWith(foldedInner) || foldedInner.endsWith(foldedPrefix))
    ) {
      output = prefix;
      continue;
    }
    output = prefix;
  }
  return output;
}

function stripMantraArtifacts(text: string) {
  let output = `${text || ""}`;
  if (!output.trim()) return "";
  output = output.replace(/^[\s\S]*?traduc(?:ao|ção)\s+para o portugues\s*:\s*/i, "");
  output = output.replace(/\s*\[(?:end of response|fim da resposta)\]\s*$/i, "");
  output = output
    .split(/\r?\n/)
    .filter((line) => {
      const normalized = normalizeFold(line);
      if (!normalized) return true;
      if (/^(confianca|confidence|confianza)\s*:/i.test(normalized)) return false;
      if (/^(verificado em|verified at|verificado en)\s*:/i.test(normalized)) return false;
      if (/^leitura inicial\s*:/i.test(normalized)) return false;
      if (/^perfil comportamental\s*:/i.test(normalized)) return false;
      if (/^sinal epistemic[oa]\s*:/i.test(normalized)) return false;
      if (/^consistencia filosofica\s*:/i.test(normalized)) return false;
      if (/^resposta\s*:\s*(evit|prioriz|explic|preserv|manter)\b/i.test(normalized)) return false;
      if (/^(priorizar explicitude de incerteza quando aplicavel|evitar afirmacoes absolutas sem evidencia)\b/i.test(normalized)) {
        return false;
      }
      if (/\blegacy-module\s*=|\bruntimescore\s*=/i.test(normalized)) return false;
      if (
        /^(respondo com naturalidade|respondo como uma pessoa util|i respond naturally|i respond as a helpful professional)\b/i.test(
          normalized,
        )
      ) {
        return false;
      }
      return true;
    })
    .join("\n");
  output = output.replace(/\bA resposta foi alinhada ao escopo solicitado\.\s*/gi, "");
  output = output.replace(/\bLeitura inicial\s*:\s*[^.\n]*\.?/gi, " ");
  output = output.replace(
    /\bVou desenvolver isso com voce de forma progressiva,\s*separando o que esta mais consolidado do que ainda precisa de teste\.?/gi,
    " ",
  );
  output = output.replace(/\bPerfil comportamental\s*:\s*[^.\n]*\.?/gi, " ");
  output = output.replace(/\bSinal epistemic[oa]\s*:\s*[^.\n]*\.?/gi, " ");
  output = output.replace(/\bConsistencia filosofica\s*:\s*[^.\n]*\.?/gi, " ");
  output = output.replace(/\bResposta\s*:\s*(?:evit|prioriz|explic|preserv|manter)[^.\n]*\.?/gi, " ");
  output = output.replace(/\bPriorizar explicitude de incerteza quando aplicavel\.?/gi, " ");
  output = output.replace(/\bEvitar afirmacoes absolutas sem evidencia\.?/gi, " ");
  output = output.replace(/\blegacy-module\s*=\s*[a-z0-9_-]+[^.\n]*\.?/gi, " ");
  output = output.replace(/\bruntimeScore\s*=\s*[-\d.]+[^.\n]*\.?/gi, " ");
  output = output.replace(/texto traduzido para o espanhol\s*:\s*/gi, "");
  output = output.replace(/traduc(?:ao|ção)\s+para o portugues\s*:\s*/gi, "");
  output = output.replace(/\bhere is the spanish text\s*:\s*/gi, "");
  output = output.replace(/\brespuesta priorizando el contexto[\s\S]*$/i, " ");
  output = output.replace(/\s*\[[^\]]*doc\s*\d+[^\]]*\]\s*/gi, " ");
  output = output.replace(/\bnota\s*:\s*algumas afirmacoes nao tiveram evidencia direta nos trechos recuperados\.?/gi, " ");
  output = output.replace(/\s{2,}/g, " ");
  output = output.replace(/\n{3,}/g, "\n\n");
  return output.trim();
}

function hasInternalArtifactLeak(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  return (
    /\b(priorizar explicitude de incerteza quando aplicavel|evitar afirmacoes absolutas sem evidencia)\b/.test(normalized) ||
    /\blegacy module\s*=|\blegacy-module\s*=|\bruntimescore\s*=/.test(normalized) ||
    /\b(perfil comportamental|sinal epistemic[oa]|consistencia filosofica)\b/.test(normalized) ||
    /\b(texto traduzido para o espanhol|traducao para o portugues)\b/.test(normalized)
  );
}

function buildCoherenceRecoveryReply(ctx: PipelineContext) {
  const languageFamily = resolveLanguageFamily(ctx);
  if (languageFamily === "en") {
    return "I had an internal formatting issue in this turn. Please resend your question and I will answer directly.";
  }
  return "Houve ruído interno na formulação desta resposta. Reenvie sua pergunta e eu respondo de forma direta.";
}

const INTERNAL_FALLBACK_LINE_PATTERNS: RegExp[] = [
  /^sem\s+ressalva(?:s)?(?:\s+(?:dominante|adicionais?))?[\.\!\?]*$/i,
  /^sem\s+sintese\s+disponivel[\.\!\?]*$/i,
  /^sem\s+evidencia\s+dominante[\.\!\?]*$/i,
  /^sem\s+hipotese\s+dominante[\.\!\?]*$/i,
  /^sem\s+dependencia\s+latente\s+dominante[\.\!\?]*$/i,
  /^sem\s+overclaim\s+dominante[\.\!\?]*$/i,
  /^sem\s+pressuposto\s+dominante[\.\!\?]*$/i,
  /^sem\s+caveat\s+dominante[\.\!\?]*$/i,
  /^sem\s+tensoes?\s+contextuais\s+dominantes[\.\!\?]*$/i,
];

function isInternalFallbackLine(value: string) {
  const normalized = normalizeFold(value);
  if (!normalized) return false;
  return INTERNAL_FALLBACK_LINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function stripInternalFallbackMarkers(text: string) {
  let output = `${text || ""}`.trim();
  if (!output) return "";
  output = output
    .split(/\r?\n/g)
    .filter((line) => !isInternalFallbackLine(line))
    .join("\n");
  output = output.replace(/\bsem\s+ressalva(?:s)?\s+dominante\b/gi, " ");
  output = output.replace(/\bsem\s+sintese\s+disponivel\b/gi, " ");
  output = output.replace(/\s{2,}/g, " ");
  output = output.replace(/\n{3,}/g, "\n\n");
  return output.trim();
}

function sanitizeChatArtifacts(text: string, userMessage: string) {
  let output = repairUtf8Mojibake(`${text || ""}`);
  if (!output.trim()) return "";
  output = stripPersonaLabelPrefix(output);
  output = stripEchoedUserMessage(output, userMessage);
  output = stripQuestionAnswerEnvelope(output);
  output = stripAnswerLabelPrefix(output);
  output = stripTrailingAnswerWrapper(output);
  output = stripMantraArtifacts(output);
  output = stripInternalFallbackMarkers(output);
  output = stripLeadingGreetingForVerifiableQuestion(output, userMessage);
  output = trimOuterParentheses(output);
  output = output.replace(/^\s*[-–—:：]\s*/, "");
  output = output.replace(/\n{3,}/g, "\n\n").trim();
  return repairUtf8Mojibake(output);
}

function createChatStreamSanitizerStream(stream: ReadableStream<Uint8Array>, userMessage: string) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      let prefixBuffer = "";
      let prefixFlushed = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || !value.length) continue;
          const chunkText = decoder.decode(value, { stream: true });
          if (!chunkText) continue;
          if (!prefixFlushed) {
            prefixBuffer += chunkText;
            const shouldFlushPrefix =
              prefixBuffer.length >= STREAM_PREFIX_BUFFER_MAX_CHARS ||
              /\n\n/.test(prefixBuffer) ||
              /[.!?)]\s*$/.test(prefixBuffer);
            if (!shouldFlushPrefix) continue;
            const sanitizedPrefix = sanitizeChatArtifacts(prefixBuffer, userMessage);
            if (sanitizedPrefix) controller.enqueue(encoder.encode(sanitizedPrefix));
            prefixFlushed = true;
            prefixBuffer = "";
            continue;
          }
          controller.enqueue(encoder.encode(chunkText));
        }
        const tail = decoder.decode();
        if (!prefixFlushed) {
          const sanitized = sanitizeChatArtifacts(`${prefixBuffer}${tail}`, userMessage);
          if (sanitized) controller.enqueue(encoder.encode(sanitized));
        } else if (tail) {
          controller.enqueue(encoder.encode(tail));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function createVerifiableGuardedChatStream(stream: ReadableStream<Uint8Array>, ctx: PipelineContext) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      let text = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || !value.length) continue;
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        let finalText = enforceChatResponseStructure(ctx, text);
        finalText = enforceConversationalSemanticGuard(ctx, finalText);
        finalText = enforceVerifiableWebGuard(ctx, finalText);
        finalText = enforceDocumentGroundingClarification(ctx, finalText);
        finalText = enforceIdentityClarificationGuard(ctx, finalText);
        finalText = repairUtf8Mojibake(finalText);
        if (finalText) controller.enqueue(encoder.encode(finalText));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function toConversationPerceptionState(ctx: PipelineContext): ConversationPerceptionState {
  const fallback: ConversationPerceptionState = {
    active_topic: "conversa em andamento",
    active_subtopic: "",
    active_task: "responder ao objetivo imediato do usuario",
    active_text_reference: "",
    user_constraints: ctx.constraints || [],
    required_style: "resposta contextualizada e natural",
    response_mode: "conversation",
    unresolved_pending_point: "",
    last_contextual_decision: "",
    continuity_anchor: "",
    continuity_mode: "continue",
    updated_at: Date.now(),
  };
  const raw = ctx.processState && typeof ctx.processState === "object" ? (ctx.processState as Record<string, unknown>) : null;
  if (!raw) return fallback;
  const state = raw.conversation_state;
  if (!state || typeof state !== "object") return fallback;
  const row = state as Record<string, unknown>;
  return {
    active_topic: `${row.active_topic || fallback.active_topic}`,
    active_subtopic: `${row.active_subtopic || ""}`,
    active_task: `${row.active_task || fallback.active_task}`,
    active_text_reference: `${row.active_text_reference || ""}`,
    user_constraints: Array.isArray(row.user_constraints)
      ? row.user_constraints.map((item) => `${item || ""}`.trim()).filter(Boolean)
      : fallback.user_constraints,
    required_style: `${row.required_style || fallback.required_style}`,
    response_mode: `${row.response_mode || fallback.response_mode}`,
    unresolved_pending_point: `${row.unresolved_pending_point || ""}`,
    last_contextual_decision: `${row.last_contextual_decision || ""}`,
    continuity_anchor: `${row.continuity_anchor || ""}`,
    continuity_mode:
      row.continuity_mode === "adjust" || row.continuity_mode === "replace" || row.continuity_mode === "continue"
        ? row.continuity_mode
        : "continue",
    updated_at: Number(row.updated_at) || fallback.updated_at,
  };
}

type MicroConversationalIntent =
  | "greeting"
  | "gratitude"
  | "assistant_identity"
  | "assistant_name_origin"
  | "assistant_creator";

function normalizeMicroIntentText(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesMicroFamily(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

const MICRO_CREATOR_PATTERNS: RegExp[] = [
  /\b(quem (?:e|eh)\s+(?:o\s+)?medeiros|e quem (?:e|eh)\s+medeiros|quem (?:e|eh)\s+esse\s+medeiros)\b/,
  /\b(quem te criou|quem criou voce|quem e seu criador|quem desenvolveu voce)\b/,
  /\b(quem idealizou (?:voce|o projeto)|quem te batizou)\b/,
];

const MICRO_NAME_ORIGIN_PATTERNS: RegExp[] = [
  /\b((por que|porque|pq)\s+(voce|vc|ce)\s+(tem|usa)\s+(esse\s+)?nome)\b/,
  /\b((por que|porque|pq)\s+(voce|vc|ce)\s+se\s+chama\s+leticia)\b/,
  /\b(qual(?:\s+(?:e|eh))?\s+a\s+origem\s+do\s+seu\s+nome|de onde vem o nome leticia|de onde veio seu nome|por que o nome leticia)\b/,
  /\b(o que significa leticia|qual o significado(?:\s+do\s+nome)?(?:\s+de)?\s+leticia|leticia significa o que|esse nome significa o que)\b/,
  /\b(o que quer dizer leticia|qual o sentido do nome leticia)\b/,
];

const MICRO_IDENTITY_PATTERNS: RegExp[] = [
  /\b(qual\s+(?:(?:e|eh|o)\s+)?(?:o\s+)?(?:seu|teu)\s+nome|qual\s+nome\s+da\s+ia)\b/,
  /\b(me diga (?:o\s+)?seu nome|me diz (?:o\s+)?seu nome|diga (?:o\s+)?seu nome)\b/,
  /\b(como (?:voce|vc|ce) se chama|quem (?:e|eh) (?:voce|vc|ce)|e o seu)\b/,
  /\b(voce (?:e|eh) a leticia|vc (?:e|eh) a leticia|quem (?:e|eh) a leticia)\b/,
];

const MICRO_GRATITUDE_PATTERNS: RegExp[] = [
  /^(obrigado|obrigada|obg|valeu|thanks|thank you)(\b|$)/,
];

const MICRO_GREETING_PATTERNS: RegExp[] = [
  /^(oi|ola|oie|oii|opa|fala|salve|e ai|eae|hey|hello|hi)(?: leticia)?$/,
  /^(bom dia|boa tarde|boa noite)(?: leticia)?$/,
  /^(como vc (?:esta|ta)|como voce (?:esta|ta)|como ce (?:esta|ta)|tudo bem(?: com (?:vc|voce|ce))?|blz|beleza|tudo certo|tudo tranquilo)(?: leticia)?$/,
];

function detectMicroConversationalIntent(value: string): MicroConversationalIntent | null {
  const normalized = normalizeMicroIntentText(value);
  if (!normalized) return null;
  if (matchesMicroFamily(normalized, MICRO_CREATOR_PATTERNS)) {
    return "assistant_creator";
  }
  if (matchesMicroFamily(normalized, MICRO_NAME_ORIGIN_PATTERNS)) {
    return "assistant_name_origin";
  }
  if (matchesMicroFamily(normalized, MICRO_IDENTITY_PATTERNS)) {
    return "assistant_identity";
  }
  if (matchesMicroFamily(normalized, MICRO_GRATITUDE_PATTERNS)) {
    return "gratitude";
  }
  if (matchesMicroFamily(normalized, MICRO_GREETING_PATTERNS)) {
    return "greeting";
  }
  return null;
}

function isMicroSocialPrompt(value: string) {
  return detectMicroConversationalIntent(value) !== null;
}

function resolveGreetingLeadFromMessage(value: string) {
  const normalized = normalizeMicroIntentText(value);
  if (/\bbom dia\b/.test(normalized)) return "Bom dia!";
  if (/\bboa tarde\b/.test(normalized)) return "Boa tarde!";
  if (/\bboa noite\b/.test(normalized)) return "Boa noite!";
  return "Oi!";
}

function hasHighSentenceRepetition(text: string) {
  const units = `${text || ""}`
    .split(/[.!?]\s+/g)
    .map((item) => normalizeFold(item))
    .filter((item) => item.length >= 24);
  if (units.length < 3) return false;
  const counts = new Map<string, number>();
  for (const unit of units) {
    counts.set(unit, (counts.get(unit) || 0) + 1);
    if ((counts.get(unit) || 0) >= 3) return true;
  }
  return false;
}

function hasConversationalSemanticAnomaly(text: string) {
  const raw = `${text || ""}`.trim();
  if (!raw) return true;
  const normalized = normalizeFold(raw);
  if (!normalized) return true;
  if (/(?:Ã.|â€|ï¿½)/.test(raw)) return true;
  if (/\b(minha nome|pelo prazer|sem sintese disponivel|sem ressalva dominante|sem ressalvas dominantes?)\b/.test(normalized)) return true;
  if (hasHighSentenceRepetition(raw)) return true;
  return false;
}

function hasUnexpectedEnglishLeak(rawText: string) {
  const normalized = normalizeFold(rawText);
  if (!normalized) return false;
  return (
    /\b(if you meant|my answer is|i am here to help|how are you|you are welcome|in portuguese)\b/.test(normalized) ||
    /\b(now we can return to|before we continue)\b/.test(normalized)
  );
}

function hasUnexpectedLanguageDrift(ctx: PipelineContext, text: string) {
  if (resolveLanguageFamily(ctx) !== "pt") return false;
  return hasUnexpectedEnglishLeak(text);
}

function hasNameOriginGrounding(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  const hasConceptualBase =
    /\b(language engineered technology for intelligent cognition interaction and assistance|cognicao|interacao|assistencia)\b/.test(
      normalized,
    );
  const hasAffectiveBase = /\b(homenagem|filha|medeiros|dimensao afetiva)\b/.test(normalized);
  return hasConceptualBase && hasAffectiveBase;
}

function countMicroSentences(text: string) {
  return `${text || ""}`
    .split(/[.!?]\s+/g)
    .map((item) => normalizeFold(item))
    .filter(Boolean).length;
}

function hasUnrequestedIdentityDetailInGreeting(text: string) {
  const normalized = normalizeFold(text);
  if (!normalized) return false;
  return /\b(language engineered technology for intelligent cognition interaction and assistance|homenagem|filha leticia|arquitetura tecnica|dimensao afetiva)\b/.test(
    normalized,
  );
}

function hasMicroOveranswer(intent: MicroConversationalIntent, text: string) {
  if (intent !== "greeting" && intent !== "gratitude") return false;
  const compact = `${text || ""}`.trim();
  if (!compact) return true;
  return compact.length > 220 || countMicroSentences(compact) > 4 || hasUnrequestedIdentityDetailInGreeting(compact);
}

function buildCanonicalMicroConversationalReply(ctx: PipelineContext, intent: MicroConversationalIntent) {
  const languageFamily = resolveLanguageFamily(ctx);
  if (languageFamily === "en") {
    if (intent === "assistant_creator") {
      return (
        "In this IA context, Medeiros is the creator of the Letícia project. " +
        "He defined the conceptual base of the system and the affective origin of the name. " +
        "If you mean another person named Medeiros, tell me which one so I can answer accurately."
      );
    }
    if (intent === "assistant_name_origin") {
      return (
        "I am called Letícia for two connected reasons. " +
        "The conceptual reason is that LETICIA summarizes Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance, " +
        "which defines my role around language, cognition, interaction, and assistance. " +
        "The affective reason is that Letícia is also the name of Medeiros' daughter, as a personal tribute at the origin of the project."
      );
    }
    if (intent === "assistant_identity") return "I am Letícia.";
    if (intent === "gratitude") return "You are welcome. I am here to help with whatever you need next.";
    return "Hi! I am Letícia. How can I help you now?";
  }
  if (intent === "assistant_creator") {
    return (
      "No contexto desta IA, Medeiros é o idealizador do projeto Letícia. " +
      "Ele definiu a base conceitual do sistema e a base afetiva do nome. " +
      "Se você estiver falando de outro Medeiros, me diga qual para eu responder com precisão."
    );
  }
  if (intent === "assistant_name_origin") {
    return (
      "Eu me chamo Letícia por duas bases complementares. " +
      "A base conceitual é que LETICIA condensa Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance, " +
      "que define meu foco em linguagem, cognição, interação e assistência. " +
      "A base afetiva é uma homenagem de Medeiros à sua filha Letícia. " +
      "Por isso, meu nome une arquitetura técnica e vínculo humano."
    );
  }
  if (intent === "assistant_identity") return "Eu sou a Letícia.";
  if (intent === "gratitude") return "De nada. Eu sigo com você no que precisar.";
  return `${resolveGreetingLeadFromMessage(ctx.userMessage)} Eu sou a Letícia. Como posso te ajudar agora?`;
}

function enforceConversationalSemanticGuard(ctx: PipelineContext, text: string) {
  const intent = detectMicroConversationalIntent(ctx.userMessage);
  if (!intent) return text;
  const normalizedOutput = normalizeFold(text);
  const mentionsLeticia = /\bleticia\b/.test(normalizedOutput);
  const hasAnomaly = hasConversationalSemanticAnomaly(text);
  const hasLanguageDrift = hasUnexpectedLanguageDrift(ctx, text);

  if (intent === "assistant_name_origin") {
    if (!hasAnomaly && !hasLanguageDrift && hasNameOriginGrounding(text)) return text;
    return buildCanonicalMicroConversationalReply(ctx, intent);
  }
  if (intent === "assistant_identity") {
    if (mentionsLeticia && !hasAnomaly && !hasLanguageDrift) return text;
    return buildCanonicalMicroConversationalReply(ctx, intent);
  }
  if (intent === "assistant_creator") {
    if (!hasAnomaly && !hasLanguageDrift && /\b(idealizador|criador|projeto leticia|outro medeiros)\b/.test(normalizedOutput)) {
      return text;
    }
    return buildCanonicalMicroConversationalReply(ctx, intent);
  }
  if (hasMicroOveranswer(intent, text)) {
    return buildCanonicalMicroConversationalReply(ctx, intent);
  }
  if (!hasAnomaly && !hasLanguageDrift) return text;
  return buildCanonicalMicroConversationalReply(ctx, intent);
}

function resolveChatComplexity(ctx: PipelineContext, answer: string): "micro" | "direct" | "short" | "medium" | "complex" {
  const userMessage = `${ctx.userMessage || ""}`.trim();
  const text = `${answer || ""}`.trim();
  if (isMicroSocialPrompt(userMessage)) return "micro";
  if (text.length <= 140) return "direct";
  if (text.length <= 360) return "short";
  if (text.length <= 1_200) return "medium";
  return "complex";
}

function enforceChatResponseStructure(ctx: PipelineContext, text: string) {
  const sanitized = sanitizeChatArtifacts(text, ctx.userMessage);
  const state = toConversationPerceptionState(ctx);
  const complexity = resolveChatComplexity(ctx, sanitized || text);
  const enforced = enforceResponseStructure(sanitized || text, { state, complexity });
  if (hasInternalArtifactLeak(text)) {
    return enforced || sanitized || buildCoherenceRecoveryReply(ctx);
  }
  return enforced || sanitized || text;
}

export class PostprocessStage implements Stage {
  constructor(
    private readonly ragService?: RagQueryService,
    private readonly redundancyFilter = new RedundancyFilterService(),
    private readonly outlineGuard = new OutlineGuardService(),
    private readonly structureEnforcer = new GenericStructureEnforcer(),
  ) {}

  async run(ctx: PipelineContext) {
    ctx.progress.stage = "postprocess";
    if (ctx.stream) {
      if (ctx.mode === "chat" && ctx.finalStream) {
        const sanitizedStream = createChatStreamSanitizerStream(ctx.finalStream, ctx.userMessage);
        const requiresVerifiableGuard =
          (isVerifiableCurrentQuestion(ctx.userMessage) || isAuthorYearGroundingQuestion(ctx.userMessage)) &&
          !hasScopedDocumentInput(ctx);
        const requiresDocumentClarificationGuard =
          hasScopedDocumentInput(ctx) && isDocumentGroundingRequest(ctx.userMessage) && !hasGroundedDocumentEvidence(ctx);
        const requiresIdentityClarificationGuard = extractMissingIdentityFields(collectUserConversationText(ctx)).length > 0;
        const requiresConversationalSemanticGuard = detectMicroConversationalIntent(ctx.userMessage) !== null;
        if (
          requiresVerifiableGuard ||
          requiresDocumentClarificationGuard ||
          requiresIdentityClarificationGuard ||
          requiresConversationalSemanticGuard
        ) {
          ctx.finalStream = createVerifiableGuardedChatStream(sanitizedStream, ctx);
        } else {
          ctx.finalStream = sanitizedStream;
        }
      }
      ctx.progress.filteredRedundancy = true;
      return;
    }

    const draft = `${ctx.finalAnswer || ctx.draftAnswer || ""}`.trim();
    const deduped = this.redundancyFilter.reduce(draft);
    const scoped = this.outlineGuard.preserveScope(deduped, ctx.constraints, ctx.plan);
    const guarded = this.outlineGuard.apply(scoped, ctx);
    let finalText = guarded;
    const skipHeavyAcademicPostprocess = ctx.mode === "chat" && ctx.ragRuntimeMode === "lite";

    const enforcerEnabled = parseBooleanEnv(process.env.ACADEMIC_ENFORCER_ENABLED, true);
    if (!skipHeavyAcademicPostprocess && enforcerEnabled && ctx.templateSpec) {
      const languageTag = `${ctx.language?.tag || process.env.ACADEMIC_DEFAULT_LANG || ctx.templateSpec.langTag}`.trim();
      let enforced = this.structureEnforcer.enforce(finalText, ctx.templateSpec, languageTag);
      ctx.qualityGate = enforced.metrics;
      finalText = enforced.renderedText;

      const repairEnabled = parseBooleanEnv(process.env.ACADEMIC_REPAIR_ENABLED, true);
      const maxRepairPasses = parsePositiveIntEnv(process.env.ACADEMIC_REPAIR_MAX_PASSES, DEFAULT_REPAIR_PASSES);
      let pass = 0;
      while (
        !skipHeavyAcademicPostprocess &&
        repairEnabled &&
        this.ragService &&
        enforced.metrics.needsRepair &&
        pass < maxRepairPasses
      ) {
        const repairPrompt = buildRepairPrompt(ctx, enforced.repairPrompt, finalText);
        const repairResult = await this.ragService.query({
          ...ctx.ragInput,
          question: repairPrompt,
          history: toRagHistory(ctx.conversation),
          requestId: `${ctx.requestId}:repair:${pass + 1}`,
          preferredResponseLanguageId: languageTag,
          pipelineModeOverride: ctx.ragRuntimeMode || ctx.ragInput.pipelineModeOverride,
        });
        const repairedText = `${repairResult.answer || ""}`.trim();
        if (repairedText) {
          finalText = repairedText;
          ctx.ragMetadata = repairResult.metadata;
        }
        enforced = this.structureEnforcer.enforce(finalText, ctx.templateSpec, languageTag);
        ctx.qualityGate = enforced.metrics;
        finalText = enforced.renderedText;
        pass += 1;
      }
    }

    if (ctx.mode === "chat") {
      finalText = enforceChatResponseStructure(ctx, finalText);
      finalText = enforceConversationalSemanticGuard(ctx, finalText);
      finalText = enforceVerifiableWebGuard(ctx, finalText);
      finalText = enforceDocumentGroundingClarification(ctx, finalText);
      finalText = enforceIdentityClarificationGuard(ctx, finalText);
      finalText = repairUtf8Mojibake(finalText);
    }

    const nextStepCta = buildNextStepCta(ctx, finalText);
    ctx.finalAnswer = nextStepCta ? `${finalText}\n\n${nextStepCta}` : finalText;
    ctx.progress.filteredRedundancy = true;
  }
}




