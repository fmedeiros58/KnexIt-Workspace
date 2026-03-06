"""
FILE: services/response_orchestration/secondary_process_memory_service.py
RESPONSIBILITY: Short-lived persistence for per-emission secondary process memory.
FLOW ROLE: Keep orchestration state across internal generation cycles.
READS: Orchestration requests and in-cycle updates.
RAM WRITES: In-memory session state map with TTL expiration.
PERSISTS: No durable storage; process-local temporary retention only.
PRIMARY RISK: Unbounded growth if TTL cleanup is not enforced.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Dict, Optional
from uuid import uuid4

from anm_backend.audit import audit_log
from anm_backend.services.response_orchestration.config import (
    is_cross_call_secondary_memory_enabled,
    resolve_secondary_memory_max_sessions,
    resolve_secondary_memory_ttl_seconds,
)
from anm_backend.services.response_orchestration.types import (
    EmissionPlan,
    OrchestrationRequest,
    SecondaryProcessMemoryState,
)


def _utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _parse_iso(value: str) -> datetime:
    raw = str(value or "").strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _merge_unique(base: list[str], incoming: list[str], *, limit: int) -> list[str]:
    result = [str(item or "").strip() for item in base if str(item or "").strip()]
    seen = set(result)
    for item in incoming:
        clean = str(item or "").strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        result.append(clean)
        if len(result) >= max(1, limit):
            break
    return result[: max(1, limit)]


class SecondaryProcessMemoryService:
    def __init__(self) -> None:
        self._ttl_seconds = resolve_secondary_memory_ttl_seconds()
        self._max_sessions = resolve_secondary_memory_max_sessions()
        self._sessions: Dict[str, SecondaryProcessMemoryState] = {}
        self._lock = RLock()

    def _is_same_scope(self, *, request: OrchestrationRequest, state: SecondaryProcessMemoryState) -> bool:
        if state.mode != request.mode:
            return False
        if state.user_id != request.user_id:
            return False
        if request.mode == "write":
            return state.project_id == request.project_id and state.thread_id == request.thread_id
        return state.thread_id == request.thread_id

    def _find_continuity_seed(
        self,
        *,
        request: OrchestrationRequest,
        now: datetime,
    ) -> Optional[SecondaryProcessMemoryState]:
        best: Optional[SecondaryProcessMemoryState] = None
        best_updated = datetime.min.replace(tzinfo=timezone.utc)
        for state in self._sessions.values():
            if _parse_iso(state.expires_at) <= now:
                continue
            if state.stop_reason == "in_progress":
                continue
            if not self._is_same_scope(request=request, state=state):
                continue
            updated = _parse_iso(state.updated_at)
            if updated >= best_updated:
                best_updated = updated
                best = state
        return deepcopy(best) if best else None

    def cleanup_expired(self) -> int:
        with self._lock:
            now = _utc_now()
            expired_ids = [
                session_id
                for session_id, state in self._sessions.items()
                if _parse_iso(state.expires_at) <= now
            ]
            for session_id in expired_ids:
                self._sessions.pop(session_id, None)
            if expired_ids:
                audit_log(
                    component="secondary_process_memory_service",
                    event="secondary_memory_expired_cleanup",
                    payload={"expired_sessions": len(expired_ids)},
                )
            return len(expired_ids)

    def start_session(
        self,
        *,
        request: OrchestrationRequest,
        plan: EmissionPlan,
        trace_id: str,
    ) -> SecondaryProcessMemoryState:
        with self._lock:
            self.cleanup_expired()
            if len(self._sessions) >= self._max_sessions:
                oldest_session_id = min(self._sessions, key=lambda key: _parse_iso(self._sessions[key].updated_at))
                self._sessions.pop(oldest_session_id, None)
                audit_log(
                    component="secondary_process_memory_service",
                    event="secondary_memory_session_evicted",
                    payload={"session_id": oldest_session_id, "reason": "max_sessions"},
                    trace_id=trace_id,
                )

            now = _utc_now()
            seed_state = None
            if is_cross_call_secondary_memory_enabled(request.mode):
                seed_state = self._find_continuity_seed(request=request, now=now)

            planned = list(plan.planned_sections or ["resposta_principal"])
            carried_key_claims = list(seed_state.key_claims_established[-32:]) if seed_state else []
            carried_forbidden = list(seed_state.forbidden_repetitions[-64:]) if seed_state else []
            carried_terminology = list(seed_state.terminology_locked[-24:]) if seed_state else []
            carried_constraints = list(seed_state.constraints_active[-24:]) if seed_state else []
            carried_summaries = list(seed_state.chunk_summaries[-4:]) if seed_state else []
            carried_open_loops = list(seed_state.open_loops[-16:]) if seed_state else []
            continuity_bridge = seed_state.continuity_bridge if seed_state else ""
            continuation_notes = [f"continued_from:{seed_state.session_id}"] if seed_state else []
            tone_locked = request.tone_hint or (seed_state.tone_locked if seed_state else "")
            state = SecondaryProcessMemoryState(
                session_id=f"spm-{uuid4()}",
                request_id=request.request_id,
                user_id=request.user_id,
                mode=request.mode,
                project_id=request.project_id,
                thread_id=request.thread_id,
                prompt_original=request.prompt_original,
                objective_current=request.objective_current,
                response_mode=plan.response_mode,
                planned_sections=planned,
                current_step_index=0,
                completed_steps=[],
                pending_steps=list(planned),
                key_claims_established=carried_key_claims,
                constraints_active=_merge_unique(carried_constraints, list(request.constraints), limit=24),
                forbidden_repetitions=carried_forbidden,
                terminology_locked=_merge_unique(carried_terminology, list(request.locked_terminology), limit=24),
                tone_locked=tone_locked,
                partial_chunks=[],
                chunk_summaries=carried_summaries,
                continuity_bridge=continuity_bridge,
                local_decisions=continuation_notes,
                open_loops=carried_open_loops,
                depth_frontier="initial",
                estimated_coverage=0.0,
                redundancy_map={},
                contradiction_flags=[],
                token_budget_consumed=0,
                cycle_count=0,
                max_cycles=max(1, int(plan.max_cycles)),
                stop_reason="in_progress",
                continued_from_session_id=seed_state.session_id if seed_state else None,
                segment_goal=plan.phase0_segment_goal,
                first_chunk="",
                continuation_anchor=plan.phase0_open_connector,
                join_rule=plan.phase0_join_rule,
                target_style=plan.phase0_target_style,
                phase0_call_count=max(1, int(plan.phase0_call_count)),
                phase0_open_connector=plan.phase0_open_connector,
                rolling_summary="",
                compressed_state={},
                semantic_state={},
                next_intent="",
                semantic_direction="",
                continuity_rule=plan.phase0_join_rule,
                reflective_report={},
                inference_map={},
                redundancy_flags=[],
                created_at=now.isoformat(),
                updated_at=now.isoformat(),
                expires_at=(now + timedelta(seconds=self._ttl_seconds)).isoformat(),
            )
            self._sessions[state.session_id] = deepcopy(state)
            audit_log(
                component="secondary_process_memory_service",
                event="secondary_memory_session_started",
                payload={
                    "session_id": state.session_id,
                    "request_id": request.request_id,
                    "mode": request.mode,
                    "response_mode": state.response_mode,
                    "planned_sections": len(state.planned_sections),
                    "max_cycles": state.max_cycles,
                    "phase0_call_count": state.phase0_call_count,
                    "segment_goal": state.segment_goal,
                    "continued_from_session_id": state.continued_from_session_id,
                    "seed_claims": len(state.key_claims_established),
                    "seed_forbidden_repetitions": len(state.forbidden_repetitions),
                },
                trace_id=trace_id,
            )
            return deepcopy(state)

    def get_session(self, *, session_id: str) -> Optional[SecondaryProcessMemoryState]:
        with self._lock:
            state = self._sessions.get(session_id)
            if not state:
                return None
            if _parse_iso(state.expires_at) <= _utc_now():
                self._sessions.pop(session_id, None)
                return None
            return deepcopy(state)

    def save_session(self, *, state: SecondaryProcessMemoryState) -> SecondaryProcessMemoryState:
        with self._lock:
            now = _utc_now()
            updated = replace(
                state,
                updated_at=now.isoformat(),
                expires_at=(now + timedelta(seconds=self._ttl_seconds)).isoformat(),
            )
            self._sessions[updated.session_id] = deepcopy(updated)
            return deepcopy(updated)

    def append_cycle_chunk(
        self,
        *,
        session_id: str,
        chunk_text: str,
        chunk_summary: str,
        tokens_consumed: int,
        completed_step: Optional[str],
        continuity_bridge: str,
        local_decision: str,
        redundancy_score: float,
        rolling_summary: Optional[str] = None,
        compressed_state: Optional[Dict[str, object]] = None,
        semantic_state: Optional[Dict[str, object]] = None,
        next_intent: Optional[str] = None,
        semantic_direction: Optional[str] = None,
        continuity_rule: Optional[str] = None,
        reflective_report: Optional[Dict[str, object]] = None,
        inference_map: Optional[Dict[str, object]] = None,
        redundancy_flags: Optional[list[str]] = None,
    ) -> SecondaryProcessMemoryState:
        with self._lock:
            existing = self._sessions.get(session_id)
            if not existing:
                raise KeyError(f"secondary process memory session not found: {session_id}")

            state = deepcopy(existing)
            state.partial_chunks.append(chunk_text.strip())
            state.chunk_summaries.append(chunk_summary.strip())
            state.cycle_count = max(0, int(state.cycle_count)) + 1
            state.token_budget_consumed = max(0, int(state.token_budget_consumed) + max(0, int(tokens_consumed)))
            state.continuity_bridge = continuity_bridge.strip()
            state.local_decisions.append(local_decision.strip())
            state.redundancy_map[f"cycle_{state.cycle_count}"] = float(redundancy_score)
            state.forbidden_repetitions.append(chunk_summary.strip().lower()[:220])
            if state.phase0_call_count > 1 and state.cycle_count == 1 and not state.first_chunk:
                state.first_chunk = chunk_text.strip()
            if state.phase0_call_count > 1 and state.cycle_count == 1 and continuity_bridge.strip():
                state.continuation_anchor = continuity_bridge.strip()
            if rolling_summary is not None:
                state.rolling_summary = str(rolling_summary).strip()
            if compressed_state is not None:
                state.compressed_state = dict(compressed_state)
            if semantic_state is not None:
                state.semantic_state = dict(semantic_state)
            if next_intent is not None:
                state.next_intent = str(next_intent).strip()
            if semantic_direction is not None:
                state.semantic_direction = str(semantic_direction).strip()
            if continuity_rule is not None:
                state.continuity_rule = str(continuity_rule).strip()
            if reflective_report is not None:
                state.reflective_report = dict(reflective_report)
            if inference_map is not None:
                state.inference_map = dict(inference_map)
            if redundancy_flags is not None:
                state.redundancy_flags = [str(item).strip() for item in redundancy_flags if str(item).strip()]

            if completed_step:
                completed = completed_step.strip()
                if completed and completed in state.pending_steps:
                    state.pending_steps.remove(completed)
                if completed and completed not in state.completed_steps:
                    state.completed_steps.append(completed)
            state.current_step_index = min(state.cycle_count, max(0, len(state.planned_sections) - 1))

            total_steps = max(1, len(state.planned_sections))
            state.estimated_coverage = min(1.0, float(len(state.completed_steps) / float(total_steps)))
            state.depth_frontier = f"cycle_{state.cycle_count}"
            state.stop_reason = "in_progress"

            now = _utc_now()
            state.updated_at = now.isoformat()
            state.expires_at = (now + timedelta(seconds=self._ttl_seconds)).isoformat()
            self._sessions[session_id] = deepcopy(state)
            return deepcopy(state)

    def finalize_session(
        self,
        *,
        session_id: str,
        stop_reason: str,
        trace_id: str,
    ) -> Optional[SecondaryProcessMemoryState]:
        with self._lock:
            state = self._sessions.get(session_id)
            if not state:
                return None
            now = _utc_now()
            state.stop_reason = str(stop_reason or "completed")
            state.updated_at = now.isoformat()
            state.expires_at = (now + timedelta(seconds=self._ttl_seconds)).isoformat()
            self._sessions[session_id] = deepcopy(state)
            audit_log(
                component="secondary_process_memory_service",
                event="secondary_memory_session_finalized",
                payload={
                    "session_id": session_id,
                    "request_id": state.request_id,
                    "mode": state.mode,
                    "stop_reason": state.stop_reason,
                    "cycle_count": state.cycle_count,
                    "token_budget_consumed": state.token_budget_consumed,
                },
                trace_id=trace_id,
            )
            return deepcopy(state)
