"""
FILE: services/response_orchestration/process_memory_manager_service.py
RESPONSIBILITY: Consolidate module outputs into session-level process memory updates.
FLOW ROLE: Single write point for rolling summary, semantic state and inference/reflective traces.
READS: Compression, semantic, reflective and inference artifacts.
RAM WRITES: None directly.
PERSISTS: None.
PRIMARY RISK: Inconsistent update ordering if caller does not apply atomically.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from anm_backend.services.response_orchestration.compression_engine_service import CompressionResult
from anm_backend.services.response_orchestration.inference_engine_service import InferenceMap
from anm_backend.services.response_orchestration.reflective_analyzer_service import ReflectiveReport
from anm_backend.services.response_orchestration.semantic_controller_service import SemanticControlResult


@dataclass
class ProcessMemoryUpdate:
    rolling_summary: str
    compressed_state: Dict[str, Any]
    semantic_state: Dict[str, Any]
    next_intent: str
    semantic_direction: str
    continuity_rule: str
    redundancy_flags: List[str] = field(default_factory=list)
    reflective_report: Dict[str, Any] = field(default_factory=dict)
    inference_map: Dict[str, Any] = field(default_factory=dict)
    local_decisions: List[str] = field(default_factory=list)


@dataclass
class ProcessMemoryManagerService:
    def build_update(
        self,
        *,
        compression: CompressionResult,
        semantic: SemanticControlResult,
        reflective: ReflectiveReport,
        inference: InferenceMap,
    ) -> ProcessMemoryUpdate:
        semantic_state = {
            "next_intent": semantic.next_intent,
            "semantic_direction": semantic.semantic_direction,
            "continuity_rule": semantic.continuity_rule,
            "redundancy_flags": list(semantic.redundancy_flags),
        }
        reflective_payload = {
            "findings": list(reflective.findings),
            "coherence_alerts": list(reflective.coherence_alerts),
            "precision_alerts": list(reflective.precision_alerts),
            "cross_text_similarity": float(reflective.cross_text_similarity),
        }
        inference_payload = {
            "suggestions": list(inference.suggestions),
            "gaps": list(inference.gaps),
            "expansion_opportunities": list(inference.expansion_opportunities),
            "latent_topics": list(inference.latent_topics),
        }
        local_decisions: List[str] = []
        if reflective.coherence_alerts:
            local_decisions.append("reflective_coherence_alert_present")
        if reflective.precision_alerts:
            local_decisions.append("reflective_precision_alert_present")
        if inference.gaps:
            local_decisions.append("inference_gap_detected")
        if semantic.redundancy_flags:
            local_decisions.append("semantic_redundancy_flagged")

        return ProcessMemoryUpdate(
            rolling_summary=compression.rolling_summary,
            compressed_state=dict(compression.compressed_state),
            semantic_state=semantic_state,
            next_intent=semantic.next_intent,
            semantic_direction=semantic.semantic_direction,
            continuity_rule=semantic.continuity_rule,
            redundancy_flags=list(semantic.redundancy_flags),
            reflective_report=reflective_payload,
            inference_map=inference_payload,
            local_decisions=local_decisions,
        )
