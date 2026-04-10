export interface RecentTurnsBufferInput {
  turns: Array<{ role: "user" | "assistant"; content: string }>;
  limit?: number;
}

export interface RecentTurnsBufferOutput {
  buffer: string[];
  userTurnCount: number;
  assistantTurnCount: number;
  continuityScore: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

type Role = "user" | "assistant";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function repairCommonMojibake(value: string): { text: string; changed: boolean } {
  const repaired = `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");

  return {
    text: repaired,
    changed: repaired !== value,
  };
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function containsTranscriptLabels(value: string): boolean {
  const normalized = normalizeForMatch(value);
  if (!normalized) return false;

  return /(?:^|[\s"'“”(\[])(usuario|user|assistant|assistente|leticia)\s*[:\-]/i.test(normalized);
}

function labelMatchesRole(label: string, role: Role): boolean {
  const normalized = normalizeForMatch(label);

  if (role === "user") {
    return normalized === "usuario" || normalized === "user";
  }

  return normalized === "assistant" || normalized === "assistente" || normalized === "leticia";
}

function extractPreferredRoleSegment(value: string, preferredRole: Role): string {
  const source = `${value || ""}`.trim();
  if (!source) return "";

  const labelPattern =
    /(Usu[aá]rio|Usuario|User|Let[ií]cia|Leticia|Assistant|Assistente)\s*(?::|-)\s*/gi;

  const matches = Array.from(source.matchAll(labelPattern));
  if (matches.length === 0) {
    return source;
  }

  let lastPreferredSegment = "";
  let lastMeaningfulSegment = "";

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? source.length;

    const segment = source
      .slice(start, end)
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "");

    if (!segment) continue;

    lastMeaningfulSegment = segment;

    if (labelMatchesRole(current[1] || "", preferredRole)) {
      lastPreferredSegment = segment;
    }
  }

  return collapseWhitespace(lastPreferredSegment || lastMeaningfulSegment || source);
}

function stripResidualDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|[\s"'“”(\[])(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, " ")
    .replace(/(?:^|[\s"'“”(\[])(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, " ")
    .trim();
}

function sanitizeTurnContent(
  content: string,
  role: Role,
): {
  text: string;
  hadTranscriptContamination: boolean;
  mojibakeRepaired: boolean;
} {
  const repaired = repairCommonMojibake(`${content || ""}`);
  const hadTranscriptContamination = containsTranscriptLabels(repaired.text);

  const roleExtracted = hadTranscriptContamination
    ? extractPreferredRoleSegment(repaired.text, role)
    : repaired.text;

  const stripped = stripResidualDialogueLabels(roleExtracted);
  const collapsed = collapseWhitespace(stripped);

  return {
    text: collapsed,
    hadTranscriptContamination,
    mojibakeRepaired: repaired.changed,
  };
}

function tokenize(value: string): string[] {
  return collapseWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean);
}

export function recentTurnsBuffer(input: RecentTurnsBufferInput): RecentTurnsBufferOutput {
  const limit = Math.max(1, Math.min(16, input.limit ?? 8));
  const rawTurns = Array.isArray(input.turns) ? input.turns.slice(-limit) : [];

  let transcriptContaminationCount = 0;
  let mojibakeRepairCount = 0;
  let discardedTurnCount = 0;

  const sanitizedTurns: Array<{ role: "user" | "assistant"; content: string }> = rawTurns
    .map((turn) => {
      const role: Role = turn.role === "assistant" ? "assistant" : "user";
      const sanitized = sanitizeTurnContent(turn.content, role);

      if (sanitized.hadTranscriptContamination) {
        transcriptContaminationCount += 1;
      }
      if (sanitized.mojibakeRepaired) {
        mojibakeRepairCount += 1;
      }

      return {
        role,
        content: sanitized.text,
      };
    })
    .filter((turn) => {
      const keep = Boolean(turn.content);
      if (!keep) {
        discardedTurnCount += 1;
      }
      return keep;
    });

  const buffer = sanitizedTurns.map((turn) => turn.content);
  const userTurnCount = sanitizedTurns.filter((turn) => turn.role === "user").length;
  const assistantTurnCount = sanitizedTurns.length - userTurnCount;

  const userTurnsOnly = sanitizedTurns.filter((turn) => turn.role === "user");
  const lastUserTurn = userTurnsOnly[userTurnsOnly.length - 1]?.content || "";
  const previousUserTurn = userTurnsOnly[userTurnsOnly.length - 2]?.content || "";

  const currentTokens = new Set(tokenize(lastUserTurn));
  const previousTokens = new Set(tokenize(previousUserTurn));
  const overlap = [...currentTokens].filter((token) => previousTokens.has(token)).length;

  const continuityScore = currentTokens.size
    ? clamp01(overlap / currentTokens.size)
    : 0;

  return {
    buffer,
    userTurnCount,
    assistantTurnCount,
    continuityScore: Number(continuityScore.toFixed(4)),
    ok: true,
    component: "recent-turns-buffer",
    score: Number(continuityScore.toFixed(4)),
    detail:
      `turns=${buffer.length}; transcriptContamination=${transcriptContaminationCount}; ` +
      `mojibakeRepairs=${mojibakeRepairCount}; discarded=${discardedTurnCount}`,
    context: {
      limit,
      userTurnCount,
      assistantTurnCount,
      transcriptContaminationCount,
      mojibakeRepairCount,
      discardedTurnCount,
      effectiveTurnCount: sanitizedTurns.length,
      continuityComputedFromUserTurnsOnly: true,
      rolesPreservedInternally: true,
    },
  };
}