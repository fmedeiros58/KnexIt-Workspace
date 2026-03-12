"""ANM-side orchestrator for Leticia assistant kernel."""

from __future__ import annotations

import threading
from typing import Any, Dict, Iterable, List
from uuid import uuid4

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.assistant.leticia.kernel import build_leticia_kernel_output
from anm_backend.assistant.leticia.postprocess import clean_leticia_response_text
from anm_backend.assistant.leticia.types import LeticiaHistoryItem, LeticiaIntent
from anm_backend.assistant.leticia.utils import sanitize_model_facing_text
from anm_backend.memory.memory_manager import MemoryManager
from anm_backend.orchestrator.hypothesis_pool import Hypothesis
from anm_backend.services.identity_runtime import (
    ContinuousIdentityRuntime,
    SelfModelEngine,
    UserPatternRecognizer,
)


def _normalize_history(history: Iterable[Dict[str, Any]] | None) -> List[LeticiaHistoryItem]:
    if history is None:
        return []
    normalized: List[LeticiaHistoryItem] = []
    for row in history:
        if not isinstance(row, dict):
            continue
        role = str(row.get("role", "")).strip()
        content = sanitize_model_facing_text(row.get("content", ""))
        if role not in {"user", "assistant"} or not content:
            continue
        normalized.append({"role": role, "content": content})
    return normalized[-24:]


def _history_to_working_items(history: List[LeticiaHistoryItem]) -> List[str]:
    return [f"{item['role']}: {item['content']}" for item in history[-10:]]


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed


def _build_model_safe_identity_runtime(shared_identity_runtime: Dict[str, Any] | None) -> Dict[str, Any]:
    if not isinstance(shared_identity_runtime, dict) or not shared_identity_runtime:
        return {}

    safe_payload: Dict[str, Any] = {}

    status = sanitize_model_facing_text(shared_identity_runtime.get("status", ""))
    source = sanitize_model_facing_text(shared_identity_runtime.get("source", ""))
    captured_at = sanitize_model_facing_text(shared_identity_runtime.get("captured_at", ""))
    if status:
        safe_payload["status"] = status
    if source:
        safe_payload["source"] = source
    if captured_at:
        safe_payload["captured_at"] = captured_at

    awareness_state = shared_identity_runtime.get("awareness_state")
    if isinstance(awareness_state, dict):
        scene_mode = sanitize_model_facing_text(awareness_state.get("scene_mode", ""))
        current_interlocutor = sanitize_model_facing_text(awareness_state.get("current_interlocutor", ""))
        if scene_mode or current_interlocutor:
            safe_awareness: Dict[str, Any] = {}
            if scene_mode:
                safe_awareness["scene_mode"] = scene_mode
            if current_interlocutor:
                safe_awareness["current_interlocutor"] = current_interlocutor
            safe_payload["awareness_state"] = safe_awareness

    current_identity = shared_identity_runtime.get("current_identity")
    if isinstance(current_identity, dict):
        display_name = sanitize_model_facing_text(current_identity.get("nominal_name") or current_identity.get("label"))
        confidence = _safe_float(current_identity.get("confidence"), 0.0)
        if display_name:
            safe_payload["current_identity"] = {
                "display_name": display_name,
                "confidence": round(max(0.0, min(1.0, confidence)), 2),
            }

    visual_context = shared_identity_runtime.get("visual_context")
    if isinstance(visual_context, dict):
        scene_summary = sanitize_model_facing_text(visual_context.get("scene_summary", ""))
        persistence_level = _safe_float(visual_context.get("current_interlocutor_persistence_level"), 0.0)
        safe_visual_context: Dict[str, Any] = {}
        if scene_summary:
            safe_visual_context["scene_summary"] = scene_summary
        if persistence_level > 0:
            safe_visual_context["current_interlocutor_persistence_level"] = round(persistence_level, 2)
        if safe_visual_context:
            safe_payload["visual_context"] = safe_visual_context

    recent_scene_events = shared_identity_runtime.get("recent_scene_events")
    if isinstance(recent_scene_events, list) and recent_scene_events:
        safe_events: List[Dict[str, str]] = []
        for event in recent_scene_events[:3]:
            if not isinstance(event, dict):
                continue
            summary = sanitize_model_facing_text(event.get("summary", ""))
            event_type = sanitize_model_facing_text(event.get("event_type", ""))
            if summary or event_type:
                safe_event: Dict[str, str] = {}
                if summary:
                    safe_event["summary"] = summary
                if event_type:
                    safe_event["event_type"] = event_type
                safe_events.append(safe_event)
        if safe_events:
            safe_payload["recent_scene_events"] = safe_events

    return safe_payload


class LeticiaOrchestrator:
    """Single entrypoint to produce Leticia responses from ANM runtime."""

    def __init__(
        self,
        *,
        llm_adapter: LLMAdapter,
        memory_manager: MemoryManager | None = None,
        identity_runtime: ContinuousIdentityRuntime | None = None,
        self_model_engine: SelfModelEngine | None = None,
        user_pattern_recognizer: UserPatternRecognizer | None = None,
    ) -> None:
        self._llm_adapter = llm_adapter
        self._memory_manager = memory_manager
        self._identity_runtime = identity_runtime
        self._self_model_engine = self_model_engine
        self._user_pattern_recognizer = user_pattern_recognizer
        self._conversation_cache: Dict[str, List[LeticiaHistoryItem]] = {}
        self._lock = threading.RLock()

    @staticmethod
    def _resolve_generation_params(mode: str, intent: LeticiaIntent) -> Dict[str, float | int]:
        normalized_mode = str(mode or "chat").strip().lower()
        if intent.is_micro_turn or intent.name in {"greeting", "gratitude", "farewell"}:
            return {"max_tokens": 96, "temperature": 0.12, "top_p": 0.72}
        if normalized_mode == "voice":
            return {"max_tokens": 320, "temperature": 0.16, "top_p": 0.78}
        if normalized_mode == "proactive":
            return {"max_tokens": 440, "temperature": 0.18, "top_p": 0.8}
        return {"max_tokens": 768, "temperature": 0.2, "top_p": 0.84}

    @staticmethod
    def _build_style_hint(mode: str) -> str:
        normalized_mode = str(mode or "chat").strip().lower()
        if normalized_mode == "voice":
            return "Resposta oral curta, com frases naturais e pausas implicitas."
        if normalized_mode == "proactive":
            return "Resposta conversacional direta; sem discurso institucional."
        return "Resposta direta, natural e util; sem meta-explicacoes."

    def _resolve_shared_identity_runtime(
        self,
        *,
        user_key: str,
        provided_payload: Dict[str, Any] | None,
    ) -> Dict[str, Any]:
        if isinstance(provided_payload, dict) and provided_payload:
            return dict(provided_payload)
        if not self._identity_runtime:
            return {}
        self_model_state: Dict[str, Any] = {}
        if self._self_model_engine:
            self_model_state = self._self_model_engine.build_state(contextual_role="leticia_assistant")
        user_pattern_state: Dict[str, Any] = {}
        if self._user_pattern_recognizer:
            user_pattern_state = self._user_pattern_recognizer.snapshot(user_key=user_key)
        snapshot = self._identity_runtime.snapshot(
            self_model_state=self_model_state,
            user_pattern_state=user_pattern_state,
        ).to_dict()
        return {
            "source": "anm_identity_runtime",
            "status": snapshot.get("status") or "unknown",
            "captured_at": snapshot.get("updated_at"),
            "awareness_state": snapshot.get("awareness_state") or {},
            "current_identity": snapshot.get("current_identity"),
            "tracked_entities": snapshot.get("tracked_entities") or [],
            "visual_context": snapshot.get("visual_context") or {},
            "recent_scene_events": snapshot.get("recent_scene_events") or [],
        }

    def _resolve_conversation_history(
        self,
        *,
        conversation_key: str,
        request_history: List[LeticiaHistoryItem],
    ) -> List[LeticiaHistoryItem]:
        with self._lock:
            cached = list(self._conversation_cache.get(conversation_key, []))
            if request_history:
                self._conversation_cache[conversation_key] = list(request_history[-24:])
                return list(self._conversation_cache[conversation_key])
            if cached:
                return cached
            self._conversation_cache[conversation_key] = []
            return []

    def _append_conversation_turn(
        self,
        *,
        conversation_key: str,
        role: str,
        content: str,
    ) -> None:
        with self._lock:
            rows = list(self._conversation_cache.get(conversation_key, []))
            rows.append({"role": "user" if role == "user" else "assistant", "content": content})
            self._conversation_cache[conversation_key] = rows[-24:]

    def _ingest_turn_into_memory(
        self,
        *,
        role: str,
        content: str,
        conversation_key: str,
        trace_id: str,
    ) -> None:
        if not self._memory_manager:
            return
        salience = 0.78 if role == "user" else 0.66
        objective_fit = 0.88 if role == "user" else 0.82
        item_id = self._memory_manager.ingest_observation(
            module_id="leticia",
            nodule_id="language_nodule",
            content={
                "role": role,
                "text": content,
                "conversation_key": conversation_key,
            },
            salience=salience,
            objective_fit=objective_fit,
            stimulus_quality=0.72 if role == "user" else 0.66,
            support_density=0.62,
            trace_id=trace_id,
        )
        self._memory_manager.reinforce_item(
            item_id=item_id,
            module_id="leticia",
            score_delta=0.08 if role == "assistant" else 0.06,
            trace_id=trace_id,
        )
        self._memory_manager.run_forgetting_cycle()

    def respond(
        self,
        *,
        message: str,
        mode: str = "chat",
        locale_hint: str = "",
        history: Iterable[Dict[str, Any]] | None = None,
        shared_identity_runtime: Dict[str, Any] | None = None,
        conversation_key: str = "leticia:default",
        user_key: str = "chat-session",
    ) -> Dict[str, Any]:
        safe_message = sanitize_model_facing_text(message)
        if not safe_message:
            raise ValueError("message is required")
        safe_conversation_key = sanitize_model_facing_text(conversation_key) or "leticia:default"
        safe_user_key = sanitize_model_facing_text(user_key) or "chat-session"

        if self._user_pattern_recognizer:
            self._user_pattern_recognizer.observe_message(user_key=safe_user_key, message=safe_message)

        normalized_history = _normalize_history(history)
        conversation_history = self._resolve_conversation_history(
            conversation_key=safe_conversation_key,
            request_history=normalized_history,
        )
        effective_history = list(conversation_history)
        effective_history.append({"role": "user", "content": safe_message})

        shared_identity_payload = self._resolve_shared_identity_runtime(
            user_key=safe_user_key,
            provided_payload=shared_identity_runtime,
        )
        kernel = build_leticia_kernel_output(
            user_prompt=safe_message,
            mode=mode,
            locale_hint=locale_hint,
            shared_identity_runtime=shared_identity_payload,
        )

        trace_id = f"trace-leticia-{uuid4()}"
        self._ingest_turn_into_memory(
            role="user",
            content=safe_message,
            conversation_key=safe_conversation_key,
            trace_id=trace_id,
        )

        if kernel.plan.direct_reply:
            answer = clean_leticia_response_text(kernel.plan.direct_reply, locale=kernel.locale)
            self._append_conversation_turn(
                conversation_key=safe_conversation_key,
                role="user",
                content=safe_message,
            )
            self._append_conversation_turn(
                conversation_key=safe_conversation_key,
                role="assistant",
                content=answer,
            )
            self._ingest_turn_into_memory(
                role="assistant",
                content=answer,
                conversation_key=safe_conversation_key,
                trace_id=trace_id,
            )
            return {
                "trace_id": trace_id,
                "answer": answer,
                "locale": kernel.locale,
                "intent": kernel.intent.name,
                "mode": mode,
                "direct_reply": True,
                "metadata": {
                    "dialogue_mode": kernel.plan.mode,
                    "history_size": len(effective_history),
                    "conversation_key": safe_conversation_key,
                    "user_key": safe_user_key,
                    **kernel.metadata,
                },
            }

        params = self._resolve_generation_params(mode, kernel.intent)
        prompt_context = self._memory_manager.assemble_prompt_context(limit=6) if self._memory_manager else {}
        memory_semantic = (
            dict(prompt_context.get("global_semantic", {}))
            if isinstance(prompt_context.get("global_semantic"), dict)
            else {}
        )
        model_safe_identity_payload = _build_model_safe_identity_runtime(shared_identity_payload)
        context_payload = {
            "working": _history_to_working_items(effective_history),
            "global_semantic": {
                "leticia_mode": str(mode or "chat"),
                "leticia_intent": kernel.intent.name,
                "memory_signal_count": len(memory_semantic),
            },
            "shared_identity_runtime": model_safe_identity_payload,
            "cycle_metadata": {"followup_prompt_next": False},
        }
        anchor_hypothesis = Hypothesis(
            hypothesis_id=f"leticia-{uuid4()}",
            content=safe_message,
            score=0.82,
            probability=0.88,
            cost=0.22,
            objective_fit=0.9,
            origin_nodule="language_nodule",
            stimulus_coherence=0.86,
        )

        response = self._llm_adapter.infer(
            user_input=kernel.enriched_prompt,
            context=context_payload,
            hypotheses=[anchor_hypothesis],
            readiness_state="OPEN",
            max_tokens=int(params["max_tokens"]),
            temperature=float(params["temperature"]),
            top_p=float(params["top_p"]),
            style_hint=self._build_style_hint(mode),
            response_language=kernel.locale,
            include_followup_prompt=False,
            trace_id=trace_id,
        )
        answer = clean_leticia_response_text(response.text, locale=kernel.locale)
        self._append_conversation_turn(
            conversation_key=safe_conversation_key,
            role="user",
            content=safe_message,
        )
        self._append_conversation_turn(
            conversation_key=safe_conversation_key,
            role="assistant",
            content=answer,
        )
        self._ingest_turn_into_memory(
            role="assistant",
            content=answer,
            conversation_key=safe_conversation_key,
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "answer": answer,
            "locale": kernel.locale,
            "intent": kernel.intent.name,
            "mode": mode,
            "direct_reply": False,
            "metadata": {
                "dialogue_mode": kernel.plan.mode,
                "history_size": len(effective_history),
                "conversation_key": safe_conversation_key,
                "user_key": safe_user_key,
                "engine_model": response.model,
                "usage": dict(response.usage or {}),
                **kernel.metadata,
            },
        }
