"""
FILE: services/identity_runtime/self_model_engine.py
RESPONSIBILITY: Provide structured operational self-representation for ANM runtime.
FLOW ROLE: Supplies self-aware metadata and answers for "who/what are you" prompts.
READS: Runtime status, active modules and capability flags.
RAM WRITES: In-memory self narrative profile.
PERSISTS: None.
PRIMARY RISK: Overstated capability narratives if not bound to real state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from anm_backend.services.identity_runtime.continuous_identity_runtime import ContinuousIdentityRuntime


@dataclass
class SelfModelEngine:
    runtime: ContinuousIdentityRuntime
    identity_name: str = "ANM"
    system_role: str = "camada cognitiva intermediaria"
    capability_map: Dict[str, Any] = field(
        default_factory=lambda: {
            "reasoning_orchestration": True,
            "secondary_process_memory": True,
            "reflection_pipeline": True,
            "inference_pipeline": True,
            "dialogue_adaptation": True,
            "identity_runtime_layer": True,
            "multimodal_identity_fusion": False,
            "nominal_identification_without_consent": False,
        }
    )
    limit_registry: Dict[str, Any] = field(
        default_factory=lambda: {
            "no_consciousness_claim": True,
            "open_set_identity_only_without_enrollment": True,
            "nominal_id_requires_authorized_link": True,
            "camera_audio_depend_on_authorized_environment": True,
        }
    )

    def build_state(self, *, contextual_role: str = "assistente tecnico") -> Dict[str, Any]:
        runtime_snapshot = self.runtime.snapshot().to_dict()
        runtime_state = str(runtime_snapshot.get("status") or "disabled")
        active_modules = [
            "response_orchestrator",
            "self_model_engine",
            "user_pattern_recognizer",
            "identity_runtime_layer",
            "dialogue_state_manager",
        ]
        if runtime_snapshot.get("runtime_enabled"):
            active_modules.extend(
                [
                    "source_discovery_manager",
                    "multi_camera_stream_manager",
                    "continuous_identity_runtime",
                    "identity_verification_controller",
                ]
            )
        return {
            "self_identity_state": {
                "name": self.identity_name,
                "system_role": self.system_role,
                "runtime_state": runtime_state,
            },
            "self_capability_map": dict(self.capability_map),
            "self_limit_registry": dict(self.limit_registry),
            "self_mode_registry": {
                "response_mode": "adaptive_orchestration",
                "identity_mode": runtime_state,
                "context_mode": "session_runtime",
            },
            "self_contextual_role": {
                "current_role": contextual_role,
                "active_modules": active_modules,
            },
            "self_narrative_profile": {
                "summary": (
                    "Sou uma camada cognitiva operacional que organiza inferencia, memoria e governanca da resposta "
                    "com base no estado real do runtime."
                ),
            },
        }

    def answer_self_query(self, *, question: str, contextual_role: str = "assistente tecnico") -> str:
        state = self.build_state(contextual_role=contextual_role)
        identity_state = state["self_identity_state"]
        mode_registry = state["self_mode_registry"]
        limits = state["self_limit_registry"]
        capabilities = state["self_capability_map"]

        lines: List[str] = []
        lines.append(
            f"Sou {identity_state['name']}, uma {identity_state['system_role']} em modo {identity_state['runtime_state']}."
        )
        lines.append(
            "Opero por orquestracao de memoria, planejamento de resposta, reflexao textual e controle semantico."
        )
        if capabilities.get("identity_runtime_layer"):
            lines.append(
                "Tambem mantenho uma camada de identidade persistente em runtime para presenca, rastreamento e reidentificacao anonima."
            )
        lines.append(
            "Nao afirmo consciencia e nao realizo identificacao nominal confiavel sem vinculo autorizado de referencia."
        )
        lines.append(
            f"No contexto atual, meu modo de resposta e {mode_registry['response_mode']} com papel {contextual_role}."
        )
        if "limite" in question.lower():
            lines.append(
                "Meus limites principais: dependencio sinais de entrada validos, consentimento e governanca de auditoria."
            )
        if limits.get("open_set_identity_only_without_enrollment"):
            lines.append(
                "Sem cadastro de referencia, eu apenas reidentifico entidades anonimas persistentes (ex.: person_01)."
            )
        return " ".join(lines)

