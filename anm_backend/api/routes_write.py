"""
FILE: api/routes_write.py
RESPONSIBILITY: HTTP surface for write workspace domain.
FLOW ROLE: Validate /write payloads and delegate to WriteService.
READS: Request payloads and write service from app.state.
RAM WRITES: Delegated to write service/repository layer.
PERSISTS: Delegated to repository adapter.
PRIMARY RISK: Coupling with chat route if endpoints are reused incorrectly.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from anm_backend.api.schemas import (
    WriteAssistRequest,
    WriteAssistResponse,
    WriteChunkAutosaveRequest,
    WriteChunkAutosaveResponse,
    WriteContinueRequest,
    WriteContinueResponse,
    WriteChunkPatchRequest,
    WriteChunkPatchResponse,
    WriteChunkResponse,
    WriteChunkVersionsResponse,
    WriteInsertRequest,
    WriteInsertResponse,
    WriteProcessMemoryCreateRequest,
    WriteProcessMemoryCreateResponse,
    WriteProcessMemoryResponse,
    WriteProjectGlobalSummaryResponse,
    WriteProjectCreateRequest,
    WriteProjectListResponse,
    WriteProjectPatchRequest,
    WriteProjectResponse,
    WriteProjectSectionsResponse,
    WriteProjectSummarizeResponse,
    WriteReindexResponse,
    WriteReferenceAttachRequest,
    WriteReferenceResponse,
    WriteSectionSummaryResponse,
    WriteSectionCreateRequest,
    WriteSectionPatchRequest,
    WriteSectionResponse,
    WriteSectionSummarizeResponse,
)
from anm_backend.write.errors import WriteChunkVersionConflictError

router = APIRouter(prefix="/write", tags=["write"])


@router.get("/projects", response_model=WriteProjectListResponse)
def list_projects(request: Request, limit: int = 20) -> WriteProjectListResponse:
    service = request.app.state.write_service
    payload = service.list_projects(limit=limit)
    return WriteProjectListResponse(projects=payload)


@router.post("/projects", response_model=WriteProjectResponse)
def create_project(request: Request, payload: WriteProjectCreateRequest) -> WriteProjectResponse:
    service = request.app.state.write_service
    project = service.create_project(
        title=payload.title,
        description=payload.description,
        objective=payload.objective,
        session_id=payload.session_id,
        metadata=payload.metadata,
    )
    return WriteProjectResponse(project=project)


@router.patch("/projects/{project_id}", response_model=WriteProjectResponse)
def patch_project(request: Request, project_id: str, payload: WriteProjectPatchRequest) -> WriteProjectResponse:
    service = request.app.state.write_service
    try:
        project = service.update_project(
            project_id=project_id,
            title=payload.title,
            description=payload.description,
            objective=payload.objective,
            status=payload.status,
            metadata=payload.metadata,
            metadata_replace=payload.metadata_replace,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteProjectResponse(project=project)


@router.get("/projects/{project_id}", response_model=WriteProjectResponse)
def get_project(request: Request, project_id: str) -> WriteProjectResponse:
    service = request.app.state.write_service
    try:
        project = service.get_project(project_id=project_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteProjectResponse(project=project)


@router.post("/projects/{project_id}/sections", response_model=WriteSectionResponse)
def create_section(request: Request, project_id: str, payload: WriteSectionCreateRequest) -> WriteSectionResponse:
    service = request.app.state.write_service
    try:
        section = service.create_section(
            project_id=project_id,
            title=payload.title,
            kind=payload.kind,
            order=payload.order,
            content=payload.content,
            objective=payload.objective,
            outline_notes=payload.outline_notes,
            status=payload.status,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteSectionResponse(section=section)


@router.get("/projects/{project_id}/sections", response_model=WriteProjectSectionsResponse)
def list_project_sections(
    request: Request,
    project_id: str,
    include_chunks: bool = True,
    include_summaries: bool = True,
) -> WriteProjectSectionsResponse:
    service = request.app.state.write_service
    try:
        payload = service.list_project_sections(
            project_id=project_id,
            include_chunks=include_chunks,
            include_summaries=include_summaries,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteProjectSectionsResponse(**payload)


@router.patch("/sections/{section_id}", response_model=WriteSectionResponse)
def patch_section(request: Request, section_id: str, payload: WriteSectionPatchRequest) -> WriteSectionResponse:
    service = request.app.state.write_service
    try:
        section = service.update_section(
            section_id=section_id,
            title=payload.title,
            objective=payload.objective,
            outline_notes=payload.outline_notes,
            status=payload.status,
            order=payload.order,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteSectionResponse(section=section)


@router.post("/projects/{project_id}/references", response_model=WriteReferenceResponse)
def attach_reference(request: Request, project_id: str, payload: WriteReferenceAttachRequest) -> WriteReferenceResponse:
    service = request.app.state.write_service
    try:
        reference = service.attach_reference(
            project_id=project_id,
            document_id=payload.document_id,
            source_path=payload.source_path or f"document:{payload.document_id}",
            note=payload.note or "",
            metadata=payload.metadata,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteReferenceResponse(reference=reference)


@router.post("/projects/{project_id}/assist", response_model=WriteAssistResponse)
def assist_project(request: Request, project_id: str, payload: WriteAssistRequest) -> WriteAssistResponse:
    service = request.app.state.write_service
    try:
        data = service.assist_project(
            project_id=project_id,
            prompt=payload.prompt,
            section_id=payload.section_id,
            max_tokens=payload.max_tokens,
            include_followup_prompt=payload.include_followup_prompt,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=f"engine_error: {error}") from error
    return WriteAssistResponse(**data)


@router.post("/projects/{project_id}/memory", response_model=WriteProcessMemoryCreateResponse)
def add_process_memory(
    request: Request,
    project_id: str,
    payload: WriteProcessMemoryCreateRequest,
) -> WriteProcessMemoryCreateResponse:
    service = request.app.state.write_service
    try:
        memory = service.add_process_memory(
            project_id=project_id,
            section_id=payload.section_id,
            memory_type=payload.memory_type,
            title=payload.title,
            content=payload.content,
            priority=payload.priority,
            is_active=payload.is_active,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteProcessMemoryCreateResponse(memory=memory)


@router.get("/projects/{project_id}/memory", response_model=WriteProcessMemoryResponse)
def process_memory(request: Request, project_id: str) -> WriteProcessMemoryResponse:
    service = request.app.state.write_service
    try:
        process_data = service.get_process_memory(project_id=project_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteProcessMemoryResponse(project_id=project_id, process_memory=process_data)


@router.post("/continue", response_model=WriteContinueResponse)
def continue_writing(request: Request, payload: WriteContinueRequest) -> WriteContinueResponse:
    continue_service = request.app.state.write_continue_service
    try:
        data = continue_service.continue_writing(
            project_id=payload.project_id,
            instruction=payload.instruction,
            section_id=payload.section_id,
            top_k_chunks=payload.top_k_chunks,
            top_k_memories=payload.top_k_memories,
            min_paragraphs=payload.min_paragraphs,
            max_paragraphs=payload.max_paragraphs,
            max_tokens=payload.max_tokens,
            temperature=payload.temperature,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=f"engine_error: {error}") from error
    return WriteContinueResponse(**data)


@router.post("/insert", response_model=WriteInsertResponse)
def insert_chunk(request: Request, payload: WriteInsertRequest) -> WriteInsertResponse:
    service = request.app.state.write_service
    try:
        data = service.insert_chunk(
            project_id=payload.project_id,
            section_id=payload.section_id,
            content=payload.content,
            source_type=payload.source_type,
            role=payload.role,
            chunk_order=payload.chunk_order,
            version=payload.version,
            token_count=payload.token_count,
            metadata=payload.metadata,
            update_embedding=payload.update_embedding,
            summarize_section=payload.summarize_section,
            summarize_project=payload.summarize_project,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=f"write_insert_error: {error}") from error
    return WriteInsertResponse(**data)


@router.get("/chunks/{chunk_id}", response_model=WriteChunkResponse)
def get_chunk(request: Request, chunk_id: str) -> WriteChunkResponse:
    service = request.app.state.write_service
    try:
        chunk = service.get_chunk(chunk_id=chunk_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteChunkResponse(chunk=chunk)


@router.patch("/chunks/{chunk_id}", response_model=WriteChunkPatchResponse)
def patch_chunk(
    request: Request,
    chunk_id: str,
    payload: WriteChunkPatchRequest,
) -> WriteChunkPatchResponse:
    service = request.app.state.write_service
    try:
        data = service.update_chunk(
            chunk_id=chunk_id,
            content=payload.content,
            edit_source=payload.edit_source,
            token_count=payload.token_count,
            metadata=payload.metadata,
            update_embedding=payload.update_embedding,
            summarize_section=payload.summarize_section,
            summarize_project=payload.summarize_project,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=f"write_chunk_patch_error: {error}") from error
    return WriteChunkPatchResponse(**data)


@router.get("/chunks/{chunk_id}/versions", response_model=WriteChunkVersionsResponse)
def get_chunk_versions(request: Request, chunk_id: str) -> WriteChunkVersionsResponse:
    service = request.app.state.write_service
    try:
        payload = service.list_chunk_versions(chunk_id=chunk_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteChunkVersionsResponse(**payload)


@router.patch("/chunks/{chunk_id}/autosave", response_model=WriteChunkAutosaveResponse)
def autosave_chunk(
    request: Request,
    chunk_id: str,
    payload: WriteChunkAutosaveRequest,
) -> WriteChunkAutosaveResponse:
    service = request.app.state.write_service
    try:
        data = service.autosave_chunk(
            chunk_id=chunk_id,
            content=payload.content,
            client_version=payload.client_version,
            autosave_reason=payload.autosave_reason,
            editor_session_id=payload.editor_session_id,
            client_timestamp=payload.client_timestamp,
            metadata=payload.metadata,
            reindex_embedding=payload.reindex_embedding,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except WriteChunkVersionConflictError as error:
        raise HTTPException(status_code=409, detail=error.as_dict()) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return WriteChunkAutosaveResponse(**data)


@router.post("/chunks/{chunk_id}/reindex", response_model=WriteReindexResponse)
def reindex_chunk(request: Request, chunk_id: str) -> WriteReindexResponse:
    service = request.app.state.write_service
    try:
        payload = service.reindex_chunk(chunk_id=chunk_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteReindexResponse(**payload)


@router.post("/sections/{section_id}/reindex", response_model=WriteReindexResponse)
def reindex_section(request: Request, section_id: str) -> WriteReindexResponse:
    service = request.app.state.write_service
    try:
        payload = service.reindex_section(section_id=section_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteReindexResponse(**payload)


@router.post("/projects/{project_id}/reindex", response_model=WriteReindexResponse)
def reindex_project(request: Request, project_id: str) -> WriteReindexResponse:
    service = request.app.state.write_service
    try:
        payload = service.reindex_project(project_id=project_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteReindexResponse(**payload)


@router.post("/sections/{section_id}/summarize", response_model=WriteSectionSummarizeResponse)
def summarize_section(request: Request, section_id: str) -> WriteSectionSummarizeResponse:
    summary_service = request.app.state.write_summary_service
    try:
        payload = summary_service.summarize_section(section_id=section_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteSectionSummarizeResponse(**payload)


@router.get("/sections/{section_id}/summary", response_model=WriteSectionSummaryResponse)
def get_section_summary(request: Request, section_id: str) -> WriteSectionSummaryResponse:
    summary_service = request.app.state.write_summary_service
    try:
        payload = summary_service.get_section_summary(section_id=section_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteSectionSummaryResponse(summary=payload)


@router.post("/projects/{project_id}/summarize", response_model=WriteProjectSummarizeResponse)
def summarize_project(request: Request, project_id: str) -> WriteProjectSummarizeResponse:
    summary_service = request.app.state.write_summary_service
    try:
        payload = summary_service.summarize_project(project_id=project_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteProjectSummarizeResponse(**payload)


@router.get("/projects/{project_id}/summary", response_model=WriteProjectGlobalSummaryResponse)
def get_project_summary(request: Request, project_id: str) -> WriteProjectGlobalSummaryResponse:
    summary_service = request.app.state.write_summary_service
    try:
        payload = summary_service.get_project_summary(project_id=project_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return WriteProjectGlobalSummaryResponse(summary=payload)
