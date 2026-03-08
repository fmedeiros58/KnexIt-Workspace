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
    IdentityActiveLivenessStartRequest,
    IdentityEnrollmentStartRequest,
    IdentityEnrollmentSubmitRequest,
    IdentityFrameAnalyzeRequest,
    IdentityFrameAnalyzeResponse,
    IdentityObservationRequest,
    IdentitySessionStateResponse,
    IdentityTargetSearchStartRequest,
    IdentityTargetSearchStopRequest,
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


def _frame_analyzer(request: Request):
    return request.app.state.identity_frame_analyzer


def _enrollment(request: Request):
    return request.app.state.multi_view_enrollment


def _target_search(request: Request):
    return request.app.state.target_search_engine


def _active_liveness(request: Request):
    return request.app.state.active_liveness_checker


def _temporal_tracker(request: Request):
    return request.app.state.temporal_tracker


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


@router.post("/frame/analyze", response_model=IdentityFrameAnalyzeResponse)
def analyze_frame(request: Request, payload: IdentityFrameAnalyzeRequest) -> IdentityFrameAnalyzeResponse:
    analyzer = _frame_analyzer(request)
    try:
        analysis = analyzer.analyze(
            frame_data_url=payload.frame_data_url,
            source_id=payload.source_id,
            expected_view=payload.expected_view,
            track_key=payload.stability_track_key or f"{payload.source_id}:{payload.entity_id}",
            min_quality_score=payload.min_quality_score,
            require_pose_match=payload.require_pose_match,
            max_faces=payload.max_faces,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    runtime_observation_emitted = False
    if payload.emit_observation:
        runtime = _runtime(request)
        first_face = analysis.faces[0] if analysis.faces else {}
        first_face_conf = float(first_face.get("confidence", analysis.confidence))
        first_face_mode = str(first_face.get("suggested_mode", analysis.suggested_mode))
        first_face_pending = bool(first_face.get("validation_pending", analysis.validation_pending))
        first_face_metadata = dict(first_face) if isinstance(first_face, dict) else {}
        runtime.submit_observation(
            {
                "source_id": analysis.source_id,
                "face_detected": analysis.face_detected,
                "entity_id": payload.entity_id,
                "label": payload.label or payload.entity_id,
                "confidence": first_face_conf,
                "mode": first_face_mode,
                "validation_pending": first_face_pending,
                "conflict": False,
                "nominal_name": payload.nominal_name,
                "speaker_id": payload.speaker_id,
                "self_user_present": payload.self_user_present,
                "metadata": {
                    **dict(payload.metadata or {}),
                    "pose": analysis.pose or {},
                    "quality": analysis.quality or {},
                    "face": first_face_metadata,
                    "expected_view": analysis.expected_view,
                    "faces_count": len(analysis.faces or []),
                    "source": "frame_analyzer_v1",
                },
            }
        )
        runtime_observation_emitted = True

    return IdentityFrameAnalyzeResponse(
        ok=True,
        source_id=analysis.source_id,
        face_detected=analysis.face_detected,
        expected_view=analysis.expected_view,
        confidence=analysis.confidence,
        suggested_mode=analysis.suggested_mode,
        validation_pending=analysis.validation_pending,
        runtime_observation_emitted=runtime_observation_emitted,
        face_box=analysis.face_box,
        pose=analysis.pose,
        quality=analysis.quality,
        faces=analysis.faces,
        metadata={
            "should_capture": analysis.should_capture,
            "faces_count": len(analysis.faces or []),
            "capture_environments": ["left", "front", "right"],
        },
    )


@router.post("/recognition/enroll/start", response_model=IdentitySessionStateResponse)
def recognition_enroll_start(request: Request, payload: IdentityEnrollmentStartRequest) -> IdentitySessionStateResponse:
    session = _enrollment(request).start_session(
        person_id=payload.person_id,
        required_views=payload.required_views,
        min_samples_per_view=payload.min_samples_per_view,
    )
    return IdentitySessionStateResponse(ok=True, session_id=session.get("session_id", ""), status=session.get("status", "active"), payload=session)


@router.post("/recognition/enroll/submit", response_model=IdentitySessionStateResponse)
def recognition_enroll_submit(request: Request, payload: IdentityEnrollmentSubmitRequest) -> IdentitySessionStateResponse:
    session = _enrollment(request).submit_sample(
        session_id=payload.session_id,
        view=payload.view,
        embedding=payload.embedding,
        quality_score=payload.quality_score,
        metadata=payload.metadata,
    )
    if not session:
        raise HTTPException(status_code=404, detail="enrollment_session_not_found")
    if payload.close_session:
        closed = _enrollment(request).close_session(session_id=payload.session_id)
        if closed:
            session = closed
    return IdentitySessionStateResponse(ok=True, session_id=session.get("session_id", ""), status=session.get("status", "active"), payload=session)


@router.post("/recognition/search/start", response_model=IdentitySessionStateResponse)
def recognition_search_start(request: Request, payload: IdentityTargetSearchStartRequest) -> IdentitySessionStateResponse:
    engine = _target_search(request)
    if payload.vectors_by_view:
        engine.register_target_profile(person_id=payload.target_person_id, vectors_by_view=payload.vectors_by_view)
    try:
        session = engine.start_search(
            target_person_id=payload.target_person_id,
            threshold=payload.threshold,
            metadata=payload.metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return IdentitySessionStateResponse(ok=True, session_id=session.get("session_id", ""), status=session.get("status", "active"), payload=session)


@router.post("/recognition/search/stop", response_model=IdentitySessionStateResponse)
def recognition_search_stop(request: Request, payload: IdentityTargetSearchStopRequest) -> IdentitySessionStateResponse:
    session = _target_search(request).stop_search(session_id=payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="search_session_not_found")
    return IdentitySessionStateResponse(ok=True, session_id=session.get("session_id", ""), status=session.get("status", "stopped"), payload=session)


@router.post("/recognition/liveness/active/start", response_model=IdentitySessionStateResponse)
def recognition_liveness_active_start(request: Request, payload: IdentityActiveLivenessStartRequest) -> IdentitySessionStateResponse:
    challenge = _active_liveness(request).start_challenge(track_id=payload.track_id, actions=payload.actions)
    row = challenge.to_dict()
    return IdentitySessionStateResponse(ok=True, session_id=row.get("challenge_id", ""), status=row.get("status", "pending"), payload=row)


@router.get("/recognition/status/{session_id}", response_model=IdentitySessionStateResponse)
def recognition_status(request: Request, session_id: str) -> IdentitySessionStateResponse:
    search_session = _target_search(request).get_session(session_id=session_id)
    if search_session:
        return IdentitySessionStateResponse(ok=True, session_id=session_id, status=str(search_session.get("status", "active")), payload=search_session)
    enrollment_session = _enrollment(request).get_session(session_id=session_id)
    if enrollment_session:
        return IdentitySessionStateResponse(ok=True, session_id=session_id, status=str(enrollment_session.get("status", "active")), payload=enrollment_session)
    liveness_session = _active_liveness(request).get_challenge(session_id)
    if liveness_session:
        return IdentitySessionStateResponse(ok=True, session_id=session_id, status=str(liveness_session.get("status", "pending")), payload=liveness_session)
    raise HTTPException(status_code=404, detail="session_not_found")


@router.get("/recognition/track/{track_id}")
def recognition_track_status(request: Request, track_id: str, source_id: str = "") -> Dict[str, object]:
    runtime_snapshot = _snapshot_payload(request)
    selected_source = source_id or str(runtime_snapshot.get("selected_source_id") or "")
    row = _temporal_tracker(request).get_track(source_id=selected_source, track_id=track_id)
    if not row:
        raise HTTPException(status_code=404, detail="track_not_found")
    return {"ok": True, "track": row}


@router.get("/person/{person_id}/profile")
def person_profile(request: Request, person_id: str) -> Dict[str, object]:
    profile = _enrollment(request).get_profile(person_id=person_id)
    if not profile:
        raise HTTPException(status_code=404, detail="profile_not_found")
    return {"ok": True, "person_id": person_id, "profile": profile}


@router.get("/self-model")
def self_model_state(request: Request) -> Dict[str, object]:
    question = "quem e voce no sistema"
    answer = _self_model(request).answer_self_query(question=question, contextual_role="identity_runtime_monitor")
    return {"ok": True, "self_model": _self_model(request).build_state(contextual_role="identity_runtime_monitor"), "answer": answer}


@router.get("/user-pattern/{user_key}")
def user_pattern_state(request: Request, user_key: str) -> Dict[str, object]:
    return {"ok": True, "user_key": user_key, "pattern": _user_patterns(request).snapshot(user_key=user_key)}

