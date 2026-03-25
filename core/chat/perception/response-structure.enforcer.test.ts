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
});

