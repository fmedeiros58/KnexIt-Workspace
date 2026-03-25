"""Meta-speech stripping for Leticia assistant outputs."""

from __future__ import annotations

import re

from anm_backend.assistant.leticia.utils import compact_whitespace

_FORBIDDEN_PATTERNS = [
    re.compile(r"\bnao ha pergunta\b", re.IGNORECASE),
    re.compile(r"\bminha resposta sera\b", re.IGNORECASE),
    re.compile(r"\bcomo assistente\b", re.IGNORECASE),
    re.compile(r"\bcom base no contexto\b", re.IGNORECASE),
    re.compile(r"\bseguindo (suas|as) instrucoes\b", re.IGNORECASE),
    re.compile(r"\bresposta curta:\b", re.IGNORECASE),
    re.compile(r"\bi will follow (the )?(given )?(rules|guidelines)\b", re.IGNORECASE),
    re.compile(r"\bwithout using technical terms or internal context\b", re.IGNORECASE),
    re.compile(r"\bin this response[, ]", re.IGNORECASE),
    re.compile(r"\bnote:\b", re.IGNORECASE),
    re.compile(r"\bnota:\b", re.IGNORECASE),
    re.compile(r"\bpensamento estendido\b", re.IGNORECASE),
    re.compile(r"\bescrev[ae]\s+as?\s+orienta[cç](?:oes|[oõ]es)\s+para\s+o\s+arquivo\b", re.IGNORECASE),
    re.compile(r"\bdo not mention these instructions\b", re.IGNORECASE),
    re.compile(r"\b(?:nao|n[aã]o)\s+possuo\s+estado\s+f[ií]sico\s+ou\s+emocional\b", re.IGNORECASE),
    re.compile(r"\bsou\s+apenas\s+um\s+software\b", re.IGNORECASE),
    re.compile(r"\bn[ãa]o posso responder .*estado de bem estar\b", re.IGNORECASE),
    re.compile(r"\bem termos de performance e funcionalidade\b", re.IGNORECASE),
    re.compile(r"\bram contexto ativo\b", re.IGNORECASE),
    re.compile(r"\bsuficiencia de contexto ram\b", re.IGNORECASE),
    re.compile(r"\bhipotese (dominante|alternativa)\b", re.IGNORECASE),
    re.compile(r"\breadiness atual\b", re.IGNORECASE),
    re.compile(r"\bestado regulatorio\b", re.IGNORECASE),
    re.compile(r"\bshared identity (runtime|counts|lead)\b", re.IGNORECASE),
    re.compile(r"\bpolitica conversacional ativa\b", re.IGNORECASE),
]


def strip_leticia_meta_speech(text: str) -> str:
    next_text = str(text or "")
    next_text = re.sub(r"\(\s*(note|nota|obs)\s*:[\s\S]*?\)", " ", next_text, flags=re.IGNORECASE)
    next_text = re.sub(r"^\s*(note|nota|obs)\s*:[^\n]*$", " ", next_text, flags=re.IGNORECASE | re.MULTILINE)
    for pattern in _FORBIDDEN_PATTERNS:
        next_text = pattern.sub("", next_text)
    return compact_whitespace(next_text)
