"""
FILE: api/routes_debug.py
RESPONSIBILITY: Technical observability endpoints for ANM runtime.
FLOW ROLE: Read-only diagnostic inspection of cognition topology and regulatory readiness.
READS: Runtime components from app state.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Internal data exposure in production environments.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Request

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/state")
def debug_state(request: Request) -> Dict[str, Any]:
    cortex = request.app.state.cortex
    registry = request.app.state.registry
    graph = request.app.state.graph
    hypothesis_pool = request.app.state.hypothesis_pool
    readiness = request.app.state.plasticity_readiness.latest()
    regulatory = request.app.state.regulatory_state
    gate = request.app.state.contextual_gate.latest()
    return {
        "nodules": list(registry.list_ids()),
        "pathways": graph.export_state(),
        "hypotheses": hypothesis_pool.export_state(),
        "cycle": dict(cortex.cycle_metadata),
        "readiness_score": readiness.readiness_score if readiness else None,
        "readiness_state": readiness.readiness_state.value if readiness else None,
        "stress_load": regulatory.stress_load,
        "context_stability": regulatory.context_stability,
        "gate": request.app.state.contextual_gate.export_state(),
    }


@router.get("/health")
def debug_health(request: Request) -> Dict[str, Any]:
    llm_adapter = request.app.state.llm_adapter
    return {
        "ok": True,
        "engine_model": llm_adapter.engine_client.model_name,
        "engine_base_url": llm_adapter.engine_client.base_url,
        "gate_loaded": bool(request.app.state.contextual_gate.latest()),
    }
