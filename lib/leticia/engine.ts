import { LETICIA } from "./core/config";
import { loadThread, append, Msg as ChatMsg } from "./memory";
import { runNodes } from "./nodes/fusion";

export async function ask(sessionId: string, userText: string): Promise<string> {
  // ✅ aguarde o histórico antes de mapear
  const msgs: ChatMsg[] = await loadThread(sessionId, 10);
  const history: string[] = msgs.map((m) => `${m.role}: ${m.content}`);

  if (LETICIA.nodes.enabled) {
    const { best } = await runNodes(userText, history, LETICIA.nodes.topK);
    const answer = (best?.text ?? "Não consegui gerar uma resposta no momento.").trim();

    // ✅ garanta a ordem de persistência
    await append(sessionId, { role: "user", content: userText });
    await append(sessionId, { role: "assistant", content: answer });

    return answer;
  }

  // ----- fallback via adapter LLM -----
  const { getLeticiaSession } = await import("./_llmAdapter");
  const session = await getLeticiaSession();

  const promptText = `Sistema: ${LETICIA.system}
${history.join("\n")}
Pergunta: ${userText}`;

  const ans = String(
    await session.prompt(promptText, {
      temperature: 0.6,
      topP: 0.9,
      repeatPenalty: 1.05,
      maxTokens: LETICIA.superposition.maxTokens,
    })
  ).trim();

  await append(sessionId, { role: "user", content: userText });
  await append(sessionId, { role: "assistant", content: ans });

  return ans;
}
