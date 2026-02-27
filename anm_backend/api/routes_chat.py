"""
FILE: api/routes_chat.py
RESPONSIBILITY: Chat entrypoint for ANM cognitive service.
FLOW ROLE: Validate input and delegate to service layer.
READS: Chat payload and app.state service dependencies.
RAM WRITES: Delegated to cognitive service.
PERSISTS: None directly.
PRIMARY RISK: Unhandled service errors returning unclear HTTP responses.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from anm_backend.api.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(request: Request, payload: ChatRequest) -> ChatResponse:
    service = request.app.state.cognitive_service
    try:
        result = service.run_chat_turn(payload.message)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=f"engine_error: {error}") from error
    return ChatResponse(**result)
