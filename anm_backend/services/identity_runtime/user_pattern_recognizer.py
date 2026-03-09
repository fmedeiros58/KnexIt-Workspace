"""
FILE: services/identity_runtime/user_pattern_recognizer.py
RESPONSIBILITY: Detect recurring interaction patterns and response preferences.
FLOW ROLE: Feed ANM with user discourse traits for dialogue continuity.
READS: User prompt stream.
RAM WRITES: Per-user interaction profile state.
PERSISTS: None.
PRIMARY RISK: Overfitting profile from too few turns.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, List


def _normalize(value: Any) -> str:
    return str(value or "").strip().lower()


def _tokenize(text: str) -> List[str]:
    return [token for token in re.findall(r"[a-zA-Z0-9_]{3,}", text.lower()) if token]


_STOPWORDS = {
    "que",
    "para",
    "com",
    "uma",
    "por",
    "como",
    "isso",
    "essa",
    "esse",
    "the",
    "and",
    "you",
    "uma",
    "sobre",
    "quero",
    "preciso",
}


@dataclass
class _UserProfile:
    turn_count: int = 0
    total_chars: int = 0
    total_words: int = 0
    greeting_count: int = 0
    correction_count: int = 0
    clarification_count: int = 0
    topic_hits: Dict[str, int] = field(default_factory=dict)
    last_messages: List[str] = field(default_factory=list)

    def register_message(self, text: str) -> None:
        clean = text.strip()
        if not clean:
            return
        self.turn_count += 1
        self.total_chars += len(clean)
        words = [token for token in clean.split() if token]
        self.total_words += len(words)
        canonical = _normalize(clean)
        if canonical in {"oi", "ola", "bom dia", "boa tarde", "boa noite"}:
            self.greeting_count += 1
        if re.search(r"\b(corrija|corrigir|errado|ajuste|melhore)\b", canonical):
            self.correction_count += 1
        if re.search(r"\b(explica|detalha|aprofunda|duvida|nao entendi)\b", canonical):
            self.clarification_count += 1
        for token in _tokenize(canonical):
            if token in _STOPWORDS:
                continue
            self.topic_hits[token] = self.topic_hits.get(token, 0) + 1
        self.last_messages.append(clean)
        if len(self.last_messages) > 8:
            self.last_messages = self.last_messages[-8:]

    def to_state(self) -> Dict[str, Any]:
        avg_chars = (self.total_chars / self.turn_count) if self.turn_count else 0.0
        avg_words = (self.total_words / self.turn_count) if self.turn_count else 0.0
        preferred_density = "concisa" if avg_words <= 18 else "analitica"
        top_topics = sorted(self.topic_hits.items(), key=lambda item: item[1], reverse=True)[:8]
        interaction_profile = {
            "turn_count": self.turn_count,
            "avg_chars_per_turn": round(avg_chars, 2),
            "avg_words_per_turn": round(avg_words, 2),
            "preferred_density": preferred_density,
            "greeting_frequency": round(self.greeting_count / max(1, self.turn_count), 3),
            "correction_frequency": round(self.correction_count / max(1, self.turn_count), 3),
            "clarification_frequency": round(self.clarification_count / max(1, self.turn_count), 3),
        }
        discourse_pattern = {
            "recurrent_topics": [{"topic": name, "hits": hits} for name, hits in top_topics],
            "last_messages": list(self.last_messages[-4:]),
        }
        preference_signals = {
            "objective_bias": self.correction_count > 0,
            "detail_bias": avg_words >= 20,
            "dialogue_bias": self.greeting_count > 0 or self.clarification_count > 0,
        }
        continuity_traits = {
            "retomada_frequente": self.clarification_count >= 2,
            "ajuste_frequente": self.correction_count >= 2,
            "saudacao_frequente": self.greeting_count >= 2,
        }
        return {
            "user_interaction_profile": interaction_profile,
            "user_discourse_pattern": discourse_pattern,
            "user_preference_signals": preference_signals,
            "user_continuity_traits": continuity_traits,
        }


@dataclass
class UserPatternRecognizer:
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _profiles: Dict[str, _UserProfile] = field(default_factory=dict, init=False, repr=False)

    def observe_message(self, *, user_key: str, message: str) -> None:
        key = _normalize(user_key) or "anonymous"
        text = str(message or "").strip()
        if not text:
            return
        with self._lock:
            profile = self._profiles.get(key)
            if profile is None:
                profile = _UserProfile()
                self._profiles[key] = profile
            profile.register_message(text)

    def snapshot(self, *, user_key: str) -> Dict[str, Any]:
        key = _normalize(user_key) or "anonymous"
        with self._lock:
            profile = self._profiles.get(key)
            if profile is None:
                profile = _UserProfile()
                self._profiles[key] = profile
            return profile.to_state()

