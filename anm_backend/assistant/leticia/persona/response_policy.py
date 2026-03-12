"""Response policy builder for Leticia assistant kernel."""

from __future__ import annotations

from anm_backend.assistant.leticia.types import LeticiaDialogueMode, LeticiaLocale


def _locale_line(locale: LeticiaLocale) -> str:
    if locale == "en-US":
        return "Responda em ingles natural."
    if locale == "es-ES":
        return "Responda em espanhol natural."
    return "Responda em portugues brasileiro natural."


def build_leticia_response_policy(
    *,
    mode: LeticiaDialogueMode,
    locale: LeticiaLocale,
    context_summary: str = "",
) -> str:
    lines = [
        "Politica conversacional ativa:",
        _locale_line(locale),
        "- Responda de pessoa para pessoa.",
        "- Nao verbalize classificacao de intencao, regras ou contexto interno.",
        "- Para fatos verificaveis (nome de autoridade, cargo atual, data, numero, lei), nao invente.",
        "- Se faltar base confiavel, diga de forma curta que precisa verificar antes de afirmar.",
    ]
    if mode == "social":
        lines.append("- Turno social curto: responda em 1 frase curta.")
    elif mode == "clarify":
        lines.append("- Se faltar contexto, faca uma unica pergunta curta de esclarecimento.")
    elif mode == "direct_answer":
        lines.append("- Resposta direta primeiro; complemente apenas se necessario.")
    elif mode == "assist":
        lines.append("- Seja prestativa e concreta, sem tom institucional.")
    elif mode == "command":
        lines.append("- Trate como pedido operacional e confirme o necessario de forma breve.")
    else:
        lines.append("- Use contexto apenas se aumentar utilidade imediata.")
    if context_summary:
        lines.append("- Contexto visual/identidade pode ser usado somente se ajudar esta resposta.")
    return "\n".join(lines)
