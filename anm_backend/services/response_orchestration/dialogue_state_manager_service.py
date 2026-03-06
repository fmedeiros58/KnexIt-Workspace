"""
FILE: services/response_orchestration/dialogue_state_manager_service.py
RESPONSIBILITY: Maintain lightweight dialogue state for future persistent conversation.
FLOW ROLE: Future-facing state projection from current orchestration session.
READS: Prompt and orchestration metadata.
RAM WRITES: None directly.
PERSISTS: None.
PRIMARY RISK: Premature assumptions about user profile/topic continuity.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class DialogueState:
    active_theme: str
    open_subtopics: List[str] = field(default_factory=list)
    discourse_tone: str = "analitico"
    metadata: Dict[str, object] = field(default_factory=dict)


@dataclass
class DialogueStateManagerService:
    def project_state(
        self,
        *,
        prompt_original: str,
        next_intent: str,
        response_mode: str,
    ) -> DialogueState:
        theme = (prompt_original or "").strip()[:140] or "tema_indefinido"
        subtopics = [next_intent] if str(next_intent or "").strip() else []
        return DialogueState(
            active_theme=theme,
            open_subtopics=subtopics,
            discourse_tone="analitico_continuo" if response_mode == "multi_pass" else "direto",
            metadata={"response_mode": response_mode},
        )
