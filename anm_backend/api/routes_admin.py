"""
FILE: api/routes_admin.py
RESPONSIBILITY: Administrative runtime controls.
FLOW ROLE: Healthcheck, restore checkpoint and controlled reset endpoints.
READS: Runtime state components from app.state.
RAM WRITES: Controlled reset through memory manager and hypothesis pool.
PERSISTS: Optional restore through persistence bridge.
PRIMARY RISK: Misuse can clear active cognition.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from anm_backend.api.schemas import CheckpointRequest, RestoreResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/health")
def health(request: Request) -> dict:
    engine_client = request.app.state.engine_client
    probe = engine_client.health()
    return {
        "api_ok": True,
        "engine_ok": bool(probe.get("ok", False)),
        "engine_latency_ms": int(probe.get("latency_ms", -1)),
        "engine_model": str(probe.get("model", engine_client.model_name)),
        "erro": probe.get("error"),
    }


@router.get("/healthcheck")
def healthcheck(request: Request) -> dict:
    # Backward-compatible alias.
    return health(request)


@router.post("/restore", response_model=RestoreResponse)
def restore(request: Request, payload: CheckpointRequest) -> RestoreResponse:
    bridge = request.app.state.persistence_bridge
    restored = bridge.bootstrap_from_checkpoint(payload.checkpoint_id)
    if not restored:
        raise HTTPException(status_code=404, detail="checkpoint not found")
    return RestoreResponse(ok=True, checkpoint_id=payload.checkpoint_id)


@router.post("/reset")
def controlled_reset(request: Request) -> dict:
    memory_manager = request.app.state.memory_manager
    hypothesis_pool = request.app.state.hypothesis_pool
    regulatory_state = request.app.state.regulatory_state
    memory_manager.restore(
        {
            "cortex": {
                "active_context": {},
                "activation_map": {},
                "quick_index": {},
                "signal_bus": [],
                "active_hypotheses": {},
                "processing_trail": [],
                "activation_records": [],
                "cycle_metadata": {"cycle_id": 0},
                "regulatory_summary": {},
            },
            "working_memory": [],
            "global_memory": {},
            "module_memory": {},
            "nodule_memory": {},
            "regulatory_state": regulatory_state.snapshot(),
        }
    )
    hypothesis_pool.clear()
    return {"ok": True}
