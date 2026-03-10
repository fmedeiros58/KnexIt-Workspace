"""
FILE: services/response_orchestration/final_response_policy_service.py
RESPONSIBILITY: Enforce final output policy (cohesion, anti-fragmentation, continuous follow-up).
FLOW ROLE: Last formatting pass before delivery to user.
READS: Prompt and generated text.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Over-normalization can flatten intentionally structured outputs.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

from anm_backend.utils import detect_user_language

_STRUCTURE_TOKENS = (
    "passo a passo",
    "step by step",
    "liste",
    "lista",
    "enumere",
    "compar",
    "tabela",
    "quadro",
    "itens",
    "bullets",
)

_BREAK_TOKENS = (
    "por outro lado",
    "em contraste",
    "diagnostico",
    "solucao",
    "na pratica",
    "em seguida",
    "primeiro",
    "segundo",
    "terceiro",
)


def _normalize_spaces(value: str) -> str:
    return re.sub(r"[ \t]+", " ", str(value or "").strip())


def _normalize_line_breaks(value: str) -> str:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_paragraphs(value: str) -> List[str]:
    text = _normalize_line_breaks(value)
    if not text:
        return []
    paragraphs = [_normalize_spaces(item) for item in re.split(r"\n\s*\n", text) if _normalize_spaces(item)]
    if paragraphs:
        return paragraphs
    merged = _normalize_spaces(text.replace("\n", " "))
    return [merged] if merged else []


def _contains_list_markers(value: str) -> bool:
    for line in _normalize_line_breaks(value).split("\n"):
        candidate = line.strip()
        if not candidate:
            continue
        if re.match(r"^[-*]\s+", candidate):
            return True
        if re.match(r"^\d+[.)]\s+", candidate):
            return True
    return False


def _should_keep_multi_paragraph(prompt_original: str, response_text: str, paragraphs: List[str]) -> bool:
    if len(paragraphs) <= 1:
        return False
    prompt = _normalize_spaces(prompt_original).lower()
    joined = " ".join(paragraphs).lower()
    if _contains_list_markers(response_text):
        return True
    if any(token in prompt for token in _STRUCTURE_TOKENS):
        return True
    if any(token in joined for token in _BREAK_TOKENS):
        return True
    long_blocks = sum(1 for paragraph in paragraphs if len(paragraph) >= 220)
    return long_blocks >= 2


def _ensure_closed_sentence(value: str) -> str:
    text = _normalize_spaces(value)
    if not text:
        return ""
    if text[-1] not in ".!?":
        return f"{text}."
    return text


def _sentence_count(value: str) -> int:
    return len([item for item in re.split(r"[.!?]+", _normalize_spaces(value)) if item.strip()])


def _contains_followup_question(value: str) -> bool:
    text = _normalize_spaces(value).lower()
    return (
        "voce quer que eu" in text
        or "quer que eu aplique" in text
        or "do you want me to apply" in text
        or "would you like me to refine" in text
    )


def _contains_improvement_hint(value: str) -> bool:
    text = _normalize_spaces(value).lower()
    return (
        "sugestao de melhoria" in text
        or "podemos melhorar" in text
        or "improvement suggestion" in text
        or "we can refine" in text
    )


def _build_improvement_note(*, prompt_original: str, language_tag: str) -> str:
    prompt = _normalize_spaces(prompt_original).lower()
    if language_tag.startswith("en"):
        if any(token in prompt for token in ("code", "patch", "api", "architecture")):
            return (
                "Improvement suggestion: we can refine this by tightening the implementation sequence, "
                "reducing ambiguity in constraints, and adding a clearer validation checkpoint."
            )
        return (
            "Improvement suggestion: we can refine this by strengthening logical transitions, "
            "adding one level of detail where needed, and sharpening the final conclusion."
        )
    if any(token in prompt for token in ("codigo", "patch", "api", "arquitetura")):
        return (
            "Sugestao de melhoria: posso refinar isso com uma sequencia de implementacao mais objetiva, "
            "restricoes mais claras e um checkpoint de validacao mais direto."
        )
    return (
        "Sugestao de melhoria: posso aprimorar este conteudo com transicoes mais precisas, "
        "um nivel adicional de detalhamento e um fechamento mais orientado ao seu objetivo."
    )


def _build_followup_question(*, language_tag: str) -> str:
    if language_tag.startswith("en"):
        return "Do you want me to apply these improvements now?"
    return "Voce quer que eu aplique essas melhorias agora?"


@dataclass
class FinalResponsePolicyResult:
    main_text: str
    final_text: str
    merged_into_single_paragraph: bool
    added_improvement_note: bool
    added_followup_question: bool


@dataclass
class FinalResponsePolicyService:
    def apply(self, *, prompt_original: str, response_text: str) -> FinalResponsePolicyResult:
        paragraphs = _split_paragraphs(response_text)
        if not paragraphs:
            language_tag = detect_user_language(prompt_original)
            note = _build_improvement_note(prompt_original=prompt_original, language_tag=language_tag)
            question = _build_followup_question(language_tag=language_tag)
            empty_main = ""
            final_text = f"{note}\n\n{question}"
            return FinalResponsePolicyResult(
                main_text=empty_main,
                final_text=final_text,
                merged_into_single_paragraph=False,
                added_improvement_note=True,
                added_followup_question=True,
            )

        keep_multi = _should_keep_multi_paragraph(prompt_original, response_text, paragraphs)
        has_fragmented_lines = (
            len(paragraphs) == 1
            and ("\n" in _normalize_line_breaks(response_text))
            and (not _contains_list_markers(response_text))
            and (not keep_multi)
        )
        merged = (not keep_multi and len(paragraphs) > 1) or has_fragmented_lines
        main_text = "\n\n".join(paragraphs) if keep_multi else " ".join(paragraphs)
        if has_fragmented_lines:
            main_text = _normalize_spaces(main_text.replace("\n", " "))
        main_text = _ensure_closed_sentence(main_text)

        # Brevity should not look telegraphic. Add a compact closure when the output is too sparse.
        if _sentence_count(main_text) <= 1 and len(main_text) < 70:
            language_tag = detect_user_language(prompt_original)
            if language_tag.startswith("en"):
                main_text = _ensure_closed_sentence(f"{main_text} This is the core answer for your current scope")
            else:
                main_text = _ensure_closed_sentence(f"{main_text} Esse e o nucleo da resposta para o seu contexto atual")

        language_tag = detect_user_language(prompt_original)
        final_parts: List[str] = [main_text]

        added_improvement_note = False
        if not _contains_improvement_hint(main_text):
            final_parts.append(_build_improvement_note(prompt_original=prompt_original, language_tag=language_tag))
            added_improvement_note = True

        combined = "\n\n".join(final_parts)
        added_followup_question = False
        if not _contains_followup_question(combined):
            final_parts.append(_build_followup_question(language_tag=language_tag))
            added_followup_question = True

        final_text = "\n\n".join(final_parts).strip()
        return FinalResponsePolicyResult(
            main_text=main_text,
            final_text=final_text,
            merged_into_single_paragraph=merged,
            added_improvement_note=added_improvement_note,
            added_followup_question=added_followup_question,
        )
