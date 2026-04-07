import { enforceResponseStructure } from "@/core/chat/perception/response-structure.enforcer";
import type { ConversationPerceptionState } from "@/core/chat/perception/types";

const BASE_STATE: ConversationPerceptionState = {
  active_topic: "chat",
  active_subtopic: "",
  active_task: "responder",
  active_text_reference: "",
  user_constraints: [],
  required_style: "resposta natural",
  response_mode: "conversation",
  unresolved_pending_point: "",
  last_contextual_decision: "",
  continuity_anchor: "",
  continuity_mode: "continue",
  updated_at: Date.now(),
};

describe("enforceResponseStructure", () => {
  it("remove sufixo parentetico com rotulo de resposta duplicada", () => {
    const output = enforceResponseStructure("Sim, tudo bem. (Resposta em portugues brasileiro: Sim, tudo bem.)", {
      state: BASE_STATE,
      complexity: "direct",
    });
    expect(output).toMatch(/^Sim, tudo bem\.?$/i);
    expect(output).not.toMatch(/\(\s*resposta[^)]*\)/i);
  });

  it("remove prefixo de rotulo de resposta", () => {
    const output = enforceResponseStructure("Resposta: Estou pronta para ajudar.", {
      state: BASE_STATE,
      complexity: "short",
    });
    expect(output).toMatch(/^Estou pronta para ajudar\.?$/i);
    expect(output).not.toMatch(/^resposta\s*:/i);
  });

  it("remove saudacao e autoapresentacao redundantes em continuidade", () => {
    const output = enforceResponseStructure(
      "Olá, meu nome é Letícia. Sobre isso: Medeiros é o idealizador da Letícia no ai-system-anm. Se você precisar, estou por aqui.",
      {
        state: BASE_STATE,
        complexity: "short",
      },
    );
    expect(output).toMatch(/^Sobre isso:\s*Medeiros é o idealizador da Letícia/i);
    expect(output).not.toMatch(/^Olá,/i);
    expect(output).not.toMatch(/\bmeu nome é letícia\b/i);
    expect(output).not.toMatch(/\bse você precisar\b/i);
  });

  it("preserva autoidentificacao quando o turno substitui contexto", () => {
    const output = enforceResponseStructure("Meu nome é Letícia.", {
      state: {
        ...BASE_STATE,
        continuity_mode: "replace",
      },
      complexity: "short",
    });
    expect(output).toMatch(/^Meu nome é Letícia\.?$/i);
  });
});
