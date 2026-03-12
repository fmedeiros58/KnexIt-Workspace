"""Kernel composer for Leticia assistant behavior."""

from __future__ import annotations

from typing import Any, Dict

from anm_backend.assistant.leticia.dialogue import plan_leticia_turn
from anm_backend.assistant.leticia.intent import classify_leticia_intent
from anm_backend.assistant.leticia.persona import (
    build_leticia_base_system_prompt,
    build_leticia_response_policy,
)
from anm_backend.assistant.leticia.types import LeticiaKernelOutput
from anm_backend.assistant.leticia.utils import sanitize_model_facing_text


def _to_string(value: Any) -> str:
    return str(value or "").strip()


def _summarize_shared_identity_runtime(shared_identity_runtime: Dict[str, Any] | None) -> str:
    if not isinstance(shared_identity_runtime, dict) or not shared_identity_runtime:
        return ""

    lines: list[str] = []
    status = _to_string(shared_identity_runtime.get("status"))
    if status:
        lines.append(f"Status runtime de identidade: {status}")

    current_identity = shared_identity_runtime.get("current_identity")
    if isinstance(current_identity, dict):
        label = _to_string(current_identity.get("label"))
        nominal_name = _to_string(current_identity.get("nominal_name"))
        confidence_raw = current_identity.get("confidence")
        try:
            confidence = float(confidence_raw)
        except (TypeError, ValueError):
            confidence = 0.0
        identity_name = nominal_name or label
        if identity_name:
            lines.append(f"Interlocutor visual atual: {identity_name} (confianca {confidence:.2f}).")

    visual_context = shared_identity_runtime.get("visual_context")
    if isinstance(visual_context, dict):
        scene_summary = _to_string(visual_context.get("scene_summary"))
        if scene_summary:
            lines.append(f"Cena: {scene_summary}")
        persistence_level = visual_context.get("current_interlocutor_persistence_level")
        if persistence_level is not None:
            try:
                level_number = float(persistence_level)
            except (TypeError, ValueError):
                level_number = 0.0
            lines.append(f"Persistencia do interlocutor em quadro: {level_number:.2f}")

    recent_scene_events = shared_identity_runtime.get("recent_scene_events")
    if isinstance(recent_scene_events, list) and recent_scene_events:
        first_event = recent_scene_events[0] if isinstance(recent_scene_events[0], dict) else {}
        if isinstance(first_event, dict):
            summary = _to_string(first_event.get("summary"))
            event_type = _to_string(first_event.get("event_type"))
            if summary:
                lines.append(f"Evento de cena recente: {summary}")
            elif event_type:
                lines.append(f"Evento de cena recente: {event_type}")

    return "\n".join(lines)


def build_leticia_kernel_output(
    *,
    user_prompt: str,
    mode: str,
    locale_hint: str = "",
    shared_identity_runtime: Dict[str, Any] | None = None,
) -> LeticiaKernelOutput:
    safe_prompt = sanitize_model_facing_text(user_prompt)
    intent = classify_leticia_intent(safe_prompt, locale_hint=locale_hint)
    plan = plan_leticia_turn(intent)
    context_summary = _summarize_shared_identity_runtime(shared_identity_runtime)
    metadata = {
        "mode_requested": _to_string(mode) or "chat",
        "locale_hint": _to_string(locale_hint) or None,
        "context_summary_present": bool(context_summary),
    }

    if plan.direct_reply:
        return LeticiaKernelOutput(
            locale=intent.locale,
            intent=intent,
            plan=plan,
            enriched_prompt=safe_prompt,
            context_summary=context_summary,
            metadata=metadata,
        )

    system_prompt = build_leticia_base_system_prompt()
    policy_prompt = build_leticia_response_policy(mode=plan.mode, locale=intent.locale, context_summary=context_summary)
    prompt_parts = [system_prompt, policy_prompt, plan.prompt_prefix]
    if context_summary:
        prompt_parts.extend(["Contexto situacional util:", context_summary])
    prompt_parts.extend(["Ultima fala do usuario:", safe_prompt])

    enriched_prompt = "\n\n".join(part for part in prompt_parts if part)
    return LeticiaKernelOutput(
        locale=intent.locale,
        intent=intent,
        plan=plan,
        enriched_prompt=enriched_prompt,
        context_summary=context_summary,
        metadata=metadata,
    )

