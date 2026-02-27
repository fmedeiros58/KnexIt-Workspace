"""
FILE: api/routes_memory.py
RESPONSIBILITY: Expose memory inspection and checkpoint controls.
FLOW ROLE: Operational API surface over RAM state and persistence bridge.
READS: Memory manager and persistence bridge from app state.
RAM WRITES: Optional restore operations through memory manager.
PERSISTS: Checkpoint save/load operations.
PRIMARY RISK: Unsafe restore during concurrent processing.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from anm_backend.api.schemas import CheckpointRequest, CheckpointResponse, RestoreResponse

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/state")
def memory_state(request: Request) -> Dict[str, Any]:
    memory_manager = request.app.state.memory_manager
    return memory_manager.snapshot()


@router.post("/checkpoint", response_model=CheckpointResponse)
def create_checkpoint(request: Request, payload: CheckpointRequest) -> CheckpointResponse:
    bridge = request.app.state.persistence_bridge
    path = bridge.flush_checkpoint(checkpoint_id=payload.checkpoint_id)
    return CheckpointResponse(ok=True, checkpoint_id=payload.checkpoint_id, path=path)


@router.post("/restore", response_model=RestoreResponse)
def restore_checkpoint(request: Request, payload: CheckpointRequest) -> RestoreResponse:
    bridge = request.app.state.persistence_bridge
    restored = bridge.bootstrap_from_checkpoint(checkpoint_id=payload.checkpoint_id)
    if not restored:
        raise HTTPException(status_code=404, detail="checkpoint not found")
    return RestoreResponse(ok=True, checkpoint_id=payload.checkpoint_id)
