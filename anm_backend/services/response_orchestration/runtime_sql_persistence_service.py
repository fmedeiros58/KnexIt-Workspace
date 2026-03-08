"""
FILE: services/response_orchestration/runtime_sql_persistence_service.py
RESPONSIBILITY: Optional SQL persistence for orchestration runtime through PostgREST.
FLOW ROLE: Mirror in-memory secondary process state into knex_write_runtime schema.
READS: Orchestration/session artifacts from response orchestrator.
RAM WRITES: Keeps transient map between logical session key and SQL ids.
PERSISTS: Inserts/updates runtime rows in knex_write_runtime tables.
PRIMARY RISK: External SQL latency or availability can affect observability completeness.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Dict, List, Optional
from urllib import error as urlerror
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from anm_backend.audit import audit_log
from anm_backend.services.response_orchestration.config import env_bool, env_int
from anm_backend.services.response_orchestration.types import EmissionPlan, OrchestrationRequest, SecondaryProcessMemoryState
from anm_backend.utils import detect_user_language


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize(value: Any) -> str:
    return str(value or "").strip()


def _truncate(value: Any, max_chars: int) -> str:
    clean = _normalize(value)
    if len(clean) <= max_chars:
        return clean
    return clean[: max(8, max_chars - 3)].rstrip() + "..."


def _as_rows(payload: Any) -> List[Dict[str, Any]]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        return [payload]
    return []


@dataclass
class _SessionSqlLink:
    session_id: int
    document_id: int
    section_id: Optional[int] = None
    dialogue_session_id: Optional[int] = None


@dataclass
class RuntimeSqlPersistenceService:
    enabled: bool = field(default_factory=lambda: env_bool("ANM_RUNTIME_SQL_PERSIST_ENABLED", default=False))
    base_url: str = field(
        default_factory=lambda: _normalize(os.getenv("ANM_RUNTIME_SQL_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL"))
    )
    service_key: str = field(
        default_factory=lambda: _normalize(os.getenv("ANM_RUNTIME_SQL_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    )
    schema: str = field(default_factory=lambda: _normalize(os.getenv("ANM_RUNTIME_SQL_SCHEMA")) or "knex_write_runtime")
    timeout_seconds: float = field(default_factory=lambda: float(os.getenv("ANM_RUNTIME_SQL_TIMEOUT_S", "3.5")))
    failure_threshold: int = field(
        default_factory=lambda: env_int("ANM_RUNTIME_SQL_FAILURE_THRESHOLD", default=3, low=1, high=20)
    )
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _links: Dict[str, _SessionSqlLink] = field(default_factory=dict, init=False, repr=False)
    _consecutive_failures: int = field(default=0, init=False, repr=False)

    def is_enabled(self) -> bool:
        return bool(
            self.enabled and self.base_url and self.service_key and self._consecutive_failures < self.failure_threshold
        )

    def register_session(
        self,
        *,
        request: OrchestrationRequest,
        plan: EmissionPlan,
        state: SecondaryProcessMemoryState,
        call_plan: Dict[str, Any],
        repair_strategy: Dict[str, Any],
    ) -> None:
        if not self.is_enabled():
            return
        try:
            with self._lock:
                if state.session_id in self._links:
                    return

            language_code = detect_user_language(request.prompt_original)
            session_rows = self._request(
                "POST",
                "write_sessions",
                params={"on_conflict": "session_key"},
                payload=[
                    {
                        "session_key": state.session_id,
                        "user_id": request.user_id,
                        "mode": request.mode if request.mode in {"write", "chat", "hybrid"} else "hybrid",
                        "status": "active",
                        "metadata": {
                            "request_id": request.request_id,
                            "objective_current": request.objective_current,
                            "response_mode": plan.response_mode,
                            "call_plan": call_plan,
                            "repair_strategy": repair_strategy,
                            "continued_from_session_id": state.continued_from_session_id,
                            "planner_rationale": list(plan.rationale),
                        },
                    }
                ],
                prefer="resolution=merge-duplicates,return=representation",
            )
            session_row = _as_rows(session_rows)
            if not session_row:
                return
            sql_session_id = int(session_row[0]["id"])

            document_rows = self._request(
                "POST",
                "write_documents",
                payload=[
                    {
                        "session_id": sql_session_id,
                        "title": _truncate(
                            request.objective_current or request.prompt_original or "orchestration_document", 220
                        ),
                        "objective": _truncate(request.objective_current, 1000),
                        "status": "in_progress",
                        "language_code": language_code,
                        "metadata": {
                            "request_id": request.request_id,
                            "project_id": request.project_id,
                            "thread_id": request.thread_id,
                            "mode": request.mode,
                        },
                    }
                ],
                prefer="return=representation",
            )
            document_row = _as_rows(document_rows)
            if not document_row:
                return
            sql_document_id = int(document_row[0]["id"])

            section_rows = self._request(
                "POST",
                "write_sections",
                payload=[
                    {
                        "document_id": sql_document_id,
                        "section_key": _normalize(request.thread_id) or "orchestration_main",
                        "title": _truncate(
                            (plan.planned_sections[0] if plan.planned_sections else "resposta principal"),
                            220,
                        ),
                        "objective": _truncate(request.objective_current, 1000),
                        "section_order": 0,
                        "status": "drafting",
                        "metadata": {
                            "request_id": request.request_id,
                            "response_mode": plan.response_mode,
                        },
                    }
                ],
                prefer="return=representation",
            )
            section_row = _as_rows(section_rows)
            if not section_row:
                return
            sql_section_id = int(section_row[0]["id"])

            self._request(
                "POST",
                "process_memory_state",
                params={"on_conflict": "session_id"},
                payload=[
                    {
                        "session_id": sql_session_id,
                        "memory_version": 1,
                        "rolling_summary": state.rolling_summary or None,
                        "compressed_state": dict(state.compressed_state),
                        "semantic_state": dict(state.semantic_state),
                    }
                ],
                prefer="resolution=merge-duplicates,return=representation",
            )

            dialogue_rows = self._request(
                "POST",
                "dialogue_sessions",
                params={"on_conflict": "write_session_id"},
                payload=[
                    {
                        "write_session_id": sql_session_id,
                        "dialogue_mode": "assistive",
                        "status": "active",
                        "metadata": {"request_id": request.request_id},
                    }
                ],
                prefer="resolution=merge-duplicates,return=representation",
            )
            dialogue_row = _as_rows(dialogue_rows)
            dialogue_session_id = int(dialogue_row[0]["id"]) if dialogue_row else None

            with self._lock:
                self._links[state.session_id] = _SessionSqlLink(
                    session_id=sql_session_id,
                    document_id=sql_document_id,
                    section_id=sql_section_id,
                    dialogue_session_id=dialogue_session_id,
                )

            self._request(
                "POST",
                "orchestration_events",
                payload=[
                    {
                        "session_id": sql_session_id,
                        "request_id": request.request_id,
                        "event_name": "session_started",
                        "cycle_index": 0,
                        "event_payload": {
                            "response_mode": plan.response_mode,
                            "max_cycles": plan.max_cycles,
                            "target_chunk_tokens": plan.target_chunk_tokens,
                            "call_plan": call_plan,
                        },
                    }
                ],
                prefer="return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("register_session", exc, request_id=request.request_id)

    def record_cycle(
        self,
        *,
        request_id: str,
        state: SecondaryProcessMemoryState,
        cycle_index: int,
        chunk_text: str,
        chunk_summary: str,
        completion_tokens: int,
        model_name: str,
        redundancy_score: float,
        redundancy_reason: str,
        reflective_report: Optional[Dict[str, Any]],
        inference_map: Optional[Dict[str, Any]],
        local_decisions: Optional[List[str]],
    ) -> None:
        if not self.is_enabled():
            return
        try:
            link = self._resolve_link(state.session_id)
            if not link:
                return

            chunk_rows = self._request(
                "POST",
                "write_chunks",
                payload=[
                    {
                        "document_id": link.document_id,
                        "section_id": link.section_id,
                        "cycle_index": max(0, int(cycle_index)),
                        "chunk_order": max(0, int(cycle_index)),
                        "role": "assistant",
                        "content": chunk_text,
                        "token_count": max(0, int(completion_tokens)) if completion_tokens else None,
                        "continuity_anchor": _normalize(state.continuity_bridge) or None,
                        "source_type": "generated",
                        "metadata": {
                            "request_id": request_id,
                            "chunk_summary": _truncate(chunk_summary, 1000),
                            "local_decisions": list(local_decisions or []),
                        },
                    }
                ],
                prefer="return=representation",
            )
            chunk_row = _as_rows(chunk_rows)
            chunk_id = int(chunk_row[0]["id"]) if chunk_row else None

            self._request(
                "POST",
                "process_memory_state",
                params={"on_conflict": "session_id"},
                payload=[
                    {
                        "session_id": link.session_id,
                        "memory_version": max(1, int(state.cycle_count)),
                        "rolling_summary": state.rolling_summary or None,
                        "compressed_state": dict(state.compressed_state),
                        "semantic_state": dict(state.semantic_state),
                    }
                ],
                prefer="resolution=merge-duplicates,return=minimal",
            )
            self._request(
                "POST",
                "rolling_summaries",
                payload=[
                    {
                        "session_id": link.session_id,
                        "cycle_index": max(0, int(cycle_index)),
                        "summary_text": _truncate(state.rolling_summary or chunk_summary, 4000),
                        "compressed_state": dict(state.compressed_state),
                        "source_chunks": state.chunk_summaries[-3:],
                    }
                ],
                prefer="return=minimal",
            )
            self._request(
                "POST",
                "continuity_anchors",
                payload=[
                    {
                        "session_id": link.session_id,
                        "cycle_index": max(0, int(cycle_index)),
                        "anchor_text": _truncate(state.continuity_bridge or state.continuation_anchor or "", 1000),
                        "join_rule": _truncate(state.continuity_rule or state.join_rule or "", 1000) or None,
                        "target_style": _truncate(state.target_style, 300) or None,
                        "source_chunk_id": chunk_id,
                    }
                ],
                prefer="return=minimal",
            )
            self._request(
                "POST",
                "semantic_states",
                payload=[
                    {
                        "session_id": link.session_id,
                        "cycle_index": max(0, int(cycle_index)),
                        "next_intent": _truncate(state.next_intent, 500) or None,
                        "semantic_direction": _truncate(state.semantic_direction, 500) or None,
                        "continuity_rule": _truncate(state.continuity_rule, 1000) or None,
                        "state_payload": dict(state.semantic_state),
                    }
                ],
                prefer="return=minimal",
            )
            if _normalize(state.next_intent):
                self._request(
                    "POST",
                    "semantic_intents",
                    payload=[
                        {
                            "session_id": link.session_id,
                            "intent_label": _truncate(state.next_intent, 500),
                            "intent_status": "active",
                            "first_cycle": max(0, int(cycle_index)),
                            "last_cycle": max(0, int(cycle_index)),
                            "metadata": {
                                "semantic_direction": state.semantic_direction,
                                "continuity_rule": state.continuity_rule,
                            },
                        }
                    ],
                    prefer="return=minimal",
                )
            self._request(
                "POST",
                "redundancy_registry",
                payload=[
                    {
                        "session_id": link.session_id,
                        "cycle_index": max(0, int(cycle_index)),
                        "redundancy_score": float(redundancy_score),
                        "redundancy_flag": _truncate(redundancy_reason, 220) or None,
                        "notes": _truncate(", ".join(state.redundancy_flags[-5:]), 1000) or None,
                        "metadata": {
                            "redundancy_flags": list(state.redundancy_flags),
                        },
                    }
                ],
                prefer="return=minimal",
            )

            reflective = dict(reflective_report or {})
            review_id = self._persist_reflective_cycle(
                link=link,
                cycle_index=cycle_index,
                reflective_report=reflective,
                chunk_id=chunk_id,
            )

            inference = dict(inference_map or {})
            self._persist_inference_cycle(link=link, cycle_index=cycle_index, inference_map=inference)
            self._persist_module_decisions(
                link=link,
                request_id=request_id,
                cycle_index=cycle_index,
                reflective_report=reflective,
                inference_map=inference,
                local_decisions=list(local_decisions or []),
                review_id=review_id,
            )

            total_tokens = max(0, int(completion_tokens))
            self._request(
                "POST",
                "llm_call_logs",
                payload=[
                    {
                        "session_id": link.session_id,
                        "request_id": request_id,
                        "cycle_index": max(0, int(cycle_index)),
                        "provider": "vllm",
                        "model_name": _truncate(model_name or "unknown", 220),
                        "prompt_tokens": 0,
                        "completion_tokens": total_tokens,
                        "total_tokens": total_tokens,
                        "latency_ms": 0,
                        "status": "ok",
                        "metadata": {
                            "source": "response_orchestrator",
                        },
                    }
                ],
                prefer="return=minimal",
            )
            self._request(
                "POST",
                "token_usage_logs",
                payload=[
                    {
                        "session_id": link.session_id,
                        "request_id": request_id,
                        "scope": "orchestration_cycle",
                        "prompt_tokens": 0,
                        "completion_tokens": total_tokens,
                        "total_tokens": total_tokens,
                        "metadata": {"cycle_index": max(0, int(cycle_index))},
                    }
                ],
                prefer="return=minimal",
            )
            self._request(
                "POST",
                "orchestration_events",
                payload=[
                    {
                        "session_id": link.session_id,
                        "request_id": request_id,
                        "event_name": "cycle_recorded",
                        "cycle_index": max(0, int(cycle_index)),
                        "event_payload": {
                            "chunk_id": chunk_id,
                            "redundancy_score": float(redundancy_score),
                            "redundancy_reason": redundancy_reason,
                            "review_id": review_id,
                        },
                    }
                ],
                prefer="return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("record_cycle", exc, request_id=request_id)

    def finalize_session(
        self,
        *,
        request_id: str,
        state: SecondaryProcessMemoryState,
        response_text: str,
        response_mode: str,
        stop_reason: str,
        dialogue_state: Optional[Dict[str, Any]],
        turn_function: Optional[Dict[str, Any]],
        total_duration_ms: int,
        token_budget_consumed: int,
    ) -> None:
        if not self.is_enabled():
            return
        try:
            link = self._resolve_link(state.session_id)
            if not link:
                return

            self._request(
                "PATCH",
                "write_sessions",
                params={"id": f"eq.{link.session_id}"},
                payload={
                    "status": "completed",
                    "ended_at": _utc_now_iso(),
                    "metadata": {
                        "last_stop_reason": stop_reason,
                        "last_response_mode": response_mode,
                        "last_request_id": request_id,
                    },
                },
                prefer="return=minimal",
            )
            self._request(
                "POST",
                "write_assemblies",
                payload=[
                    {
                        "session_id": link.session_id,
                        "document_id": link.document_id,
                        "strategy": "orchestrator",
                        "chunk_count": max(1, int(state.cycle_count)),
                        "final_text": response_text,
                        "token_count": max(0, int(token_budget_consumed)),
                        "metadata": {
                            "response_mode": response_mode,
                            "stop_reason": stop_reason,
                            "request_id": request_id,
                        },
                    }
                ],
                prefer="return=minimal",
            )

            dialogue_payload = dict(dialogue_state or {})
            turn_payload = dict(turn_function or {})
            if link.dialogue_session_id:
                self._request(
                    "POST",
                    "dialogue_state",
                    params={"on_conflict": "dialogue_session_id"},
                    payload=[
                        {
                            "dialogue_session_id": link.dialogue_session_id,
                            "active_theme": _truncate(dialogue_payload.get("active_theme"), 1000) or None,
                            "open_subtopics": dialogue_payload.get("open_subtopics") or [],
                            "discourse_tone": _truncate(dialogue_payload.get("discourse_tone"), 200) or None,
                            "state_payload": dialogue_payload.get("metadata") or {},
                        }
                    ],
                    prefer="resolution=merge-duplicates,return=minimal",
                )
                self._request(
                    "POST",
                    "conversation_summary",
                    payload=[
                        {
                            "dialogue_session_id": link.dialogue_session_id,
                            "turn_index": max(0, int(state.cycle_count)),
                            "summary_text": _truncate(state.rolling_summary or response_text, 4000),
                            "metadata": {"request_id": request_id},
                        }
                    ],
                    prefer="return=minimal",
                )
                self._request(
                    "POST",
                    "turn_memory",
                    payload=[
                        {
                            "dialogue_session_id": link.dialogue_session_id,
                            "turn_index": max(0, int(state.cycle_count)),
                            "role": "assistant",
                            "content": _truncate(response_text, 20000),
                            "intent_label": _truncate(turn_payload.get("name"), 220) or None,
                            "metadata": {"turn_rationale": turn_payload.get("rationale")},
                        }
                    ],
                    prefer="return=minimal",
                )

            self._request(
                "POST",
                "latency_metrics",
                payload=[
                    {
                        "session_id": link.session_id,
                        "request_id": request_id,
                        "metric_name": "total_duration_ms",
                        "metric_ms": max(0, int(total_duration_ms)),
                        "cycle_index": max(0, int(state.cycle_count)),
                        "metadata": {"stop_reason": stop_reason},
                    }
                ],
                prefer="return=minimal",
            )
            self._request(
                "POST",
                "orchestration_events",
                payload=[
                    {
                        "session_id": link.session_id,
                        "request_id": request_id,
                        "event_name": "session_completed",
                        "cycle_index": max(0, int(state.cycle_count)),
                        "event_payload": {
                            "stop_reason": stop_reason,
                            "response_mode": response_mode,
                            "cycle_count": state.cycle_count,
                        },
                    }
                ],
                prefer="return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("finalize_session", exc, request_id=request_id)

    def _persist_reflective_cycle(
        self,
        *,
        link: _SessionSqlLink,
        cycle_index: int,
        reflective_report: Dict[str, Any],
        chunk_id: Optional[int],
    ) -> Optional[int]:
        findings = [str(item).strip() for item in list(reflective_report.get("findings") or []) if str(item).strip()]
        coherence_alerts = [
            str(item).strip() for item in list(reflective_report.get("coherence_alerts") or []) if str(item).strip()
        ]
        precision_alerts = [
            str(item).strip() for item in list(reflective_report.get("precision_alerts") or []) if str(item).strip()
        ]
        similarity_score = max(
            0.0,
            min(1.0, float(reflective_report.get("cross_text_similarity") or 0.0)),
        )
        if not findings and not coherence_alerts and not precision_alerts and similarity_score <= 0.0:
            return None

        contradiction_flag = any("contrad" in item.lower() for item in findings)
        review_status = "ok"
        if contradiction_flag:
            review_status = "critical"
        elif findings or coherence_alerts or precision_alerts:
            review_status = "warning"

        summary_fragments: List[str] = []
        if findings:
            summary_fragments.append(f"findings:{len(findings)}")
        if coherence_alerts:
            summary_fragments.append(f"coherence_alerts:{len(coherence_alerts)}")
        if precision_alerts:
            summary_fragments.append(f"precision_alerts:{len(precision_alerts)}")
        if similarity_score > 0.0:
            summary_fragments.append(f"cross_text_similarity:{similarity_score:.3f}")

        review_rows = self._request(
            "POST",
            "reflective_reviews",
            payload=[
                {
                    "session_id": link.session_id,
                    "cycle_index": max(0, int(cycle_index)),
                    "review_status": review_status,
                    "summary": _truncate("; ".join(summary_fragments), 2000) or None,
                    "metadata": {
                        "cross_text_similarity": similarity_score,
                    },
                }
            ],
            prefer="return=representation",
        )
        review_row = _as_rows(review_rows)
        if not review_row:
            return None
        review_id = int(review_row[0]["id"])

        finding_rows: List[Dict[str, Any]] = []
        for finding in findings:
            severity = "high" if "contrad" in finding.lower() else "medium"
            finding_rows.append(
                {
                    "review_id": review_id,
                    "finding_type": "reflective_finding",
                    "severity": severity,
                    "description": _truncate(finding, 1800),
                    "evidence": {"source": "reflective_report"},
                }
            )
        if finding_rows:
            self._request("POST", "reflective_findings", payload=finding_rows, prefer="return=minimal")

        if coherence_alerts:
            coherence_rows = [
                {
                    "review_id": review_id,
                    "alert_code": _truncate(alert, 220),
                    "alert_message": _truncate(alert.replace("_", " "), 1200),
                    "severity": "high" if "contrad" in alert.lower() else "medium",
                    "metadata": {"source": "reflective_report"},
                }
                for alert in coherence_alerts
            ]
            self._request("POST", "coherence_alerts", payload=coherence_rows, prefer="return=minimal")

        if precision_alerts:
            precision_rows = [
                {
                    "review_id": review_id,
                    "alert_code": _truncate(alert, 220),
                    "alert_message": _truncate(alert.replace("_", " "), 1200),
                    "severity": "medium",
                    "metadata": {"source": "reflective_report"},
                }
                for alert in precision_alerts
            ]
            self._request("POST", "precision_alerts", payload=precision_rows, prefer="return=minimal")

        if similarity_score > 0.0:
            self._request(
                "POST",
                "cross_text_comparisons",
                payload=[
                    {
                        "review_id": review_id,
                        "chunk_id_a": chunk_id,
                        "chunk_id_b": None,
                        "similarity_score": round(similarity_score, 4),
                        "contradiction_flag": contradiction_flag,
                        "metadata": {"source": "reflective_report"},
                    }
                ],
                prefer="return=minimal",
            )
        return review_id

    def _persist_inference_cycle(
        self,
        *,
        link: _SessionSqlLink,
        cycle_index: int,
        inference_map: Dict[str, Any],
    ) -> None:
        suggestions = [str(item).strip() for item in list(inference_map.get("suggestions") or []) if str(item).strip()]
        gaps = [str(item).strip() for item in list(inference_map.get("gaps") or []) if str(item).strip()]
        opportunities = [
            str(item).strip()
            for item in list(inference_map.get("expansion_opportunities") or [])
            if str(item).strip()
        ]
        latent_topics = [str(item).strip() for item in list(inference_map.get("latent_topics") or []) if str(item).strip()]

        if suggestions:
            suggestion_rows = []
            for idx, suggestion in enumerate(suggestions):
                suggestion_rows.append(
                    {
                        "session_id": link.session_id,
                        "cycle_index": max(0, int(cycle_index)),
                        "suggestion_text": _truncate(suggestion, 2000),
                        "priority": max(1, 90 - (idx * 10)),
                        "status": "open",
                        "metadata": {"source": "inference_map"},
                    }
                )
            self._request("POST", "inference_suggestions", payload=suggestion_rows, prefer="return=minimal")

        if gaps:
            gap_rows = []
            for gap in gaps:
                _, _, label = gap.partition(":")
                normalized_label = _truncate(label or gap, 220)
                gap_rows.append(
                    {
                        "session_id": link.session_id,
                        "cycle_index": max(0, int(cycle_index)),
                        "gap_label": normalized_label,
                        "gap_description": _truncate(gap, 1000),
                        "severity": "medium",
                        "metadata": {"source": "inference_map"},
                    }
                )
            self._request("POST", "inference_gaps", payload=gap_rows, prefer="return=minimal")

        if opportunities:
            opportunity_rows = []
            for item in opportunities:
                _, _, label = item.partition(":")
                expected_gain = 0.7 if "aprofundar" in item.lower() else 0.5
                opportunity_rows.append(
                    {
                        "session_id": link.session_id,
                        "cycle_index": max(0, int(cycle_index)),
                        "opportunity_label": _truncate(label or item, 220),
                        "rationale": _truncate(item, 1000),
                        "expected_gain": round(expected_gain, 4),
                        "metadata": {"source": "inference_map"},
                    }
                )
            self._request("POST", "expansion_opportunities", payload=opportunity_rows, prefer="return=minimal")

        if latent_topics:
            latent_rows = []
            for topic in latent_topics:
                _, _, label = topic.partition(":")
                latent_rows.append(
                    {
                        "session_id": link.session_id,
                        "topic_label": _truncate(label or topic, 220),
                        "activation_score": 0.55,
                        "last_cycle": max(0, int(cycle_index)),
                        "metadata": {"source": "inference_map"},
                    }
                )
            self._request("POST", "latent_topics", payload=latent_rows, prefer="return=minimal")

    def _persist_module_decisions(
        self,
        *,
        link: _SessionSqlLink,
        request_id: str,
        cycle_index: int,
        reflective_report: Dict[str, Any],
        inference_map: Dict[str, Any],
        local_decisions: List[str],
        review_id: Optional[int],
    ) -> None:
        rows: List[Dict[str, Any]] = []

        rows.append(
            {
                "session_id": link.session_id,
                "request_id": request_id,
                "module_name": "reflective_analyzer",
                "decision_name": "cycle_review",
                "decision_payload": {
                    "review_id": review_id,
                    "findings": len(list(reflective_report.get("findings") or [])),
                    "coherence_alerts": len(list(reflective_report.get("coherence_alerts") or [])),
                    "precision_alerts": len(list(reflective_report.get("precision_alerts") or [])),
                },
                "cycle_index": max(0, int(cycle_index)),
            }
        )
        rows.append(
            {
                "session_id": link.session_id,
                "request_id": request_id,
                "module_name": "inference_engine",
                "decision_name": "cycle_inference",
                "decision_payload": {
                    "suggestions": len(list(inference_map.get("suggestions") or [])),
                    "gaps": len(list(inference_map.get("gaps") or [])),
                    "expansion_opportunities": len(list(inference_map.get("expansion_opportunities") or [])),
                    "latent_topics": len(list(inference_map.get("latent_topics") or [])),
                },
                "cycle_index": max(0, int(cycle_index)),
            }
        )
        for decision in list(local_decisions or []):
            clean = _normalize(decision)
            if not clean:
                continue
            rows.append(
                {
                    "session_id": link.session_id,
                    "request_id": request_id,
                    "module_name": "process_memory_manager",
                    "decision_name": _truncate(clean, 220),
                    "decision_payload": {"source": "local_decisions"},
                    "cycle_index": max(0, int(cycle_index)),
                }
            )
        if rows:
            self._request("POST", "module_decisions", payload=rows, prefer="return=minimal")

    def _resolve_link(self, session_key: str) -> Optional[_SessionSqlLink]:
        normalized_session_key = _normalize(session_key)
        if not normalized_session_key:
            return None
        with self._lock:
            cached = self._links.get(normalized_session_key)
            if cached:
                return cached

        session_rows = self._request(
            "GET",
            "write_sessions",
            params={
                "session_key": f"eq.{normalized_session_key}",
                "select": "id",
                "order": "id.desc",
                "limit": "1",
            },
        )
        session_row = _as_rows(session_rows)
        if not session_row:
            return None
        sql_session_id = int(session_row[0]["id"])

        document_rows = self._request(
            "GET",
            "write_documents",
            params={
                "session_id": f"eq.{sql_session_id}",
                "select": "id",
                "order": "id.desc",
                "limit": "1",
            },
        )
        document_row = _as_rows(document_rows)
        if not document_row:
            return None
        sql_document_id = int(document_row[0]["id"])

        section_rows = self._request(
            "GET",
            "write_sections",
            params={
                "document_id": f"eq.{sql_document_id}",
                "select": "id",
                "order": "id.desc",
                "limit": "1",
            },
        )
        section_row = _as_rows(section_rows)
        sql_section_id = int(section_row[0]["id"]) if section_row else None

        dialogue_rows = self._request(
            "GET",
            "dialogue_sessions",
            params={
                "write_session_id": f"eq.{sql_session_id}",
                "select": "id",
                "order": "id.desc",
                "limit": "1",
            },
        )
        dialogue_row = _as_rows(dialogue_rows)
        dialogue_session_id = int(dialogue_row[0]["id"]) if dialogue_row else None

        link = _SessionSqlLink(
            session_id=sql_session_id,
            document_id=sql_document_id,
            section_id=sql_section_id,
            dialogue_session_id=dialogue_session_id,
        )
        with self._lock:
            self._links[normalized_session_key] = link
        return link

    def _request(
        self,
        method: str,
        table: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        payload: Optional[Any] = None,
        prefer: Optional[str] = None,
    ) -> Any:
        if not self.base_url:
            raise RuntimeError("runtime_sql_missing_base_url")
        table_name = _normalize(table)
        if not table_name:
            raise RuntimeError("runtime_sql_missing_table_name")

        base = self.base_url.rstrip("/")
        if base.endswith("/rest/v1"):
            endpoint = f"{base}/{table_name}"
        else:
            endpoint = f"{base}/rest/v1/{table_name}"

        query_params: Dict[str, str] = {}
        for key, value in (params or {}).items():
            clean_key = _normalize(key)
            if not clean_key or value is None:
                continue
            query_params[clean_key] = str(value)
        if query_params:
            endpoint = f"{endpoint}?{urlencode(query_params, doseq=True)}"

        method_name = _normalize(method).upper() or "GET"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Accept": "application/json",
            "Accept-Profile": self.schema,
        }
        if method_name in {"POST", "PATCH", "PUT", "DELETE"}:
            headers["Content-Profile"] = self.schema
        if prefer:
            headers["Prefer"] = prefer

        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

        request = Request(endpoint, data=body, headers=headers, method=method_name)
        try:
            with urlopen(request, timeout=max(0.5, float(self.timeout_seconds))) as response:  # noqa: S310
                raw = response.read()
                if not raw:
                    return None
                decoded = raw.decode("utf-8", errors="replace").strip()
                if not decoded:
                    return None
                try:
                    return json.loads(decoded)
                except json.JSONDecodeError:
                    return decoded
        except urlerror.HTTPError as exc:
            details = ""
            try:
                details = exc.read().decode("utf-8", errors="replace")
            except Exception:  # noqa: BLE001
                details = ""
            raise RuntimeError(
                f"runtime_sql_http_error:{exc.code}:{_truncate(details or str(exc.reason), 500)}"
            ) from exc
        except urlerror.URLError as exc:
            raise RuntimeError(f"runtime_sql_unreachable:{_truncate(exc.reason, 500)}") from exc

    def _register_success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0

    def _register_failure(self) -> int:
        with self._lock:
            self._consecutive_failures += 1
            return self._consecutive_failures

    def _handle_failure(self, operation: str, exc: Exception, *, request_id: str) -> None:
        error_text = str(exc)
        schema_not_exposed = "PGRST106" in error_text and "schema" in error_text.lower()
        failures = self._register_failure()
        if schema_not_exposed:
            with self._lock:
                self._consecutive_failures = max(self._consecutive_failures, int(self.failure_threshold))
                failures = self._consecutive_failures
        threshold_reached = failures >= max(1, int(self.failure_threshold))
        audit_log(
            component="runtime_sql_persistence",
            event="runtime_sql_operation_failed",
            payload={
                "operation": _normalize(operation),
                "request_id": request_id,
                "consecutive_failures": failures,
                "failure_threshold": int(self.failure_threshold),
                "disabled": threshold_reached,
                "error": _truncate(error_text, 500),
                "hint": (
                    "add_knex_write_runtime_to_supabase_api_schemas"
                    if schema_not_exposed
                    else ""
                ),
            },
            trace_id=request_id,
        )
