"""
FILE: api/routes_identity.py
RESPONSIBILITY: Runtime control and monitoring API for identity subsystem.
FLOW ROLE: Expose continuous identity runtime status/control independent of composer activation.
READS: Identity runtime state services from app.state.
RAM WRITES: Delegated runtime state transitions and observation intake.
PERSISTS: Delegated to optional identity SQL runtime service.
PRIMARY RISK: Incorrect controls can pause/disable monitoring unintentionally.
"""

from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, HTTPException, Request

from anm_backend.api.schemas import (
    IdentityObservationRequest,
    IdentityRuntimeAutoStartRequest,
    IdentityRuntimeControlRequest,
    IdentityRuntimeStatusResponse,
    IdentitySourceActiveRequest,
    IdentitySourceSelectRequest,
    IdentitySourceUpsertRequest,
)

router = APIRouter(prefix="/identity", tags=["identity"])


def _runtime(request: Request):
    return request.app.state.identity_runtime


def _self_model(request: Request):
    return request.app.state.self_model_engine


def _user_patterns(request: Request):
    return request.app.state.user_pattern_recognizer


def _snapshot_payload(request: Request, user_key: str = "chat-session") -> Dict[str, object]:
    self_state = _self_model(request).build_state(contextual_role="identity_runtime_monitor")
    user_state = _user_patterns(request).snapshot(user_key=user_key)
    snapshot = _runtime(request).snapshot(self_model_state=self_state, user_pattern_state=user_state)
    return snapshot.to_dict()


@router.get("/runtime/status", response_model=IdentityRuntimeStatusResponse)
def runtime_status(request: Request) -> IdentityRuntimeStatusResponse:
    return IdentityRuntimeStatusResponse(**_snapshot_payload(request))


@router.get("/panel", response_model=IdentityRuntimeStatusResponse)
def runtime_panel(request: Request) -> IdentityRuntimeStatusResponse:
    return IdentityRuntimeStatusResponse(**_snapshot_payload(request))


@router.post("/runtime/bootstrap")
def runtime_bootstrap(request: Request, payload: IdentityRuntimeControlRequest) -> Dict[str, object]:
    bootstrap = request.app.state.identity_runtime_bootstrap
    result = bootstrap.bootstrap(reason=payload.reason or "manual_bootstrap")
    return {"ok": True, "bootstrap": result, "runtime": _snapshot_payload(request)}


@router.post("/runtime/enable")
def runtime_enable(request: Request, payload: IdentityRuntimeControlRequest) -> Dict[str, object]:
    _runtime(request).enable_runtime(reason=payload.reason or "manual_enable")
    return {"ok": True, "runtime": _snapshot_payload(request)}


@router.post("/runtime/disable")
def runtime_disable(request: Request, payload: IdentityRuntimeControlRequest) -> Dict[str, object]:
    _runtime(request).disable_runtime(reason=payload.reason or "manual_disable")
    return {"ok": True, "runtime": _snapshot_payload(request)}


@router.post("/runtime/pause")
def runtime_pause(request: Request, payload: IdentityRuntimeControlRequest) -> Dict[str, object]:
    _runtime(request).pause_runtime(reason=payload.reason or "manual_pause")
    return {"ok": True, "runtime": _snapshot_payload(request)}


@router.post("/runtime/resume")
def runtime_resume(request: Request, payload: IdentityRuntimeControlRequest) -> Dict[str, object]:
    _runtime(request).resume_runtime(reason=payload.reason or "manual_resume")
    return {"ok": True, "runtime": _snapshot_payload(request)}


@router.post("/runtime/auto-start")
def runtime_auto_start(request: Request, payload: IdentityRuntimeAutoStartRequest) -> Dict[str, object]:
    _runtime(request).set_auto_start(enabled=payload.enabled)
    return {"ok": True, "runtime": _snapshot_payload(request)}


@router.get("/sources")
def list_sources(request: Request) -> Dict[str, object]:
    snapshot = _snapshot_payload(request)
    return {
        "ok": True,
        "sources": snapshot.get("camera_sources", []),
        "selected_source_id": snapshot.get("selected_source_id"),
    }


@router.post("/sources/discover")
def discover_sources(request: Request) -> Dict[str, object]:
    runtime = _runtime(request)
    rows = [item.to_dict() for item in runtime.refresh_sources()]
    return {"ok": True, "sources": rows, "runtime": _snapshot_payload(request)}


@router.post("/sources")
def upsert_source(request: Request, payload: IdentitySourceUpsertRequest) -> Dict[str, object]:
    runtime = _runtime(request)
    source = runtime.register_or_update_source(payload.model_dump())
    return {"ok": True, "source": source.to_dict(), "runtime": _snapshot_payload(request)}


@router.post("/sources/select")
def select_source(request: Request, payload: IdentitySourceSelectRequest) -> Dict[str, object]:
    runtime = _runtime(request)
    changed = runtime.select_source(payload.source_id)
    if not changed:
        raise HTTPException(status_code=404, detail="source_not_found_or_unavailable")
    return {"ok": True, "runtime": _snapshot_payload(request)}


@router.post("/sources/{source_id}/active")
def set_source_active(request: Request, source_id: str, payload: IdentitySourceActiveRequest) -> Dict[str, object]:
    runtime = _runtime(request)
    source = runtime.set_source_active(source_id, active=payload.active)
    if not source:
        raise HTTPException(status_code=404, detail="source_not_found")
    return {"ok": True, "source": source.to_dict(), "runtime": _snapshot_payload(request)}


@router.post("/events/observation")
def push_observation(request: Request, payload: IdentityObservationRequest) -> Dict[str, object]:
    runtime = _runtime(request)
    runtime.submit_observation(payload.model_dump())
    return {"ok": True, "runtime": _snapshot_payload(request)}


@router.get("/self-model")
def self_model_state(request: Request) -> Dict[str, object]:
    question = "quem e voce no sistema"
    answer = _self_model(request).answer_self_query(question=question, contextual_role="identity_runtime_monitor")
    return {"ok": True, "self_model": _self_model(request).build_state(contextual_role="identity_runtime_monitor"), "answer": answer}


@router.get("/user-pattern/{user_key}")
def user_pattern_state(request: Request, user_key: str) -> Dict[str, object]:
    return {"ok": True, "user_key": user_key, "pattern": _user_patterns(request).snapshot(user_key=user_key)}

