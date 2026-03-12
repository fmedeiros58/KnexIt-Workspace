"""
FILE: api/routes_leticia.py
RESPONSIBILITY: HTTP surface for Leticia assistant kernel in ANM backend.
FLOW ROLE: Validate payload and delegate response generation to Leticia orchestrator.
READS: Request payload and app.state.leticia_orchestrator.
RAM WRITES: Delegated to ANM llm adapter/runtime.
PERSISTS: None directly.
PRIMARY RISK: Returning raw engine text without guardrails.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from anm_backend.api.schemas import (
    LeticiaRespondRequest,
    LeticiaRespondResponse,
    LeticiaSynthesizeRequest,
)
from anm_backend.services.voice import (
    AzureSpeechConfigurationError,
    AzureSpeechService,
    AzureSpeechSynthesisError,
)

router = APIRouter(prefix="/assistant/leticia", tags=["assistant", "leticia"])


def _resolve_voice_service(request: Request) -> AzureSpeechService:
    service = getattr(request.app.state, "azure_speech_service", None)
    if service is not None:
        return service
    resolved = AzureSpeechService.from_env()
    request.app.state.azure_speech_service = resolved
    return resolved


@router.post("/respond", response_model=LeticiaRespondResponse)
def leticia_respond(request: Request, payload: LeticiaRespondRequest) -> LeticiaRespondResponse:
    orchestrator = request.app.state.leticia_orchestrator
    message = payload.resolve_message()
    if not message:
        raise HTTPException(status_code=400, detail="message_or_prompt_required")

    try:
        result = orchestrator.respond(
            message=message,
            mode=payload.mode,
            locale_hint=payload.locale_hint,
            history=[item.model_dump() for item in payload.history],
            shared_identity_runtime=payload.shared_identity_runtime or None,
            conversation_key=payload.conversation_key or "leticia:default",
            user_key=payload.user_key or "chat-session",
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=f"engine_error: {error}") from error
    return LeticiaRespondResponse(**result)


@router.post("/synthesize")
def leticia_synthesize(request: Request, payload: LeticiaSynthesizeRequest) -> Response:
    service = _resolve_voice_service(request)
    try:
        audio_bytes, metadata = service.synthesize(
            text=payload.text,
            locale_hint=payload.locale_hint,
            voice_id=payload.voice_id,
            rate=payload.rate,
            pitch=payload.pitch,
        )
    except AzureSpeechConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except AzureSpeechSynthesisError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=f"voice_runtime_error:{error}") from error

    headers = {
        "cache-control": "no-store",
        "x-leticia-voice-id": metadata.get("voice_id", ""),
        "x-leticia-voice-locale": metadata.get("locale", ""),
        "x-leticia-voice-provider": metadata.get("provider", "azure"),
    }
    return Response(content=audio_bytes, media_type="audio/mpeg", headers=headers)
