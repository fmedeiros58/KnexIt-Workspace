"""
FILE: services/response_orchestration/document_assembler_service.py
RESPONSIBILITY: Explicit final document assembly boundary.
FLOW ROLE: Wrapper over existing assembly services to keep architecture modular.
READS: Partial chunks and assembly controls.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Wrapper drift from underlying assembly implementation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from anm_backend.services.response_orchestration.response_assembly_service import ResponseAssemblyService


@dataclass
class DocumentAssemblerResult:
    text: str
    used_synthesis: bool


@dataclass
class DocumentAssemblerService:
    response_assembly_service: ResponseAssemblyService

    def assemble(
        self,
        *,
        mode: str,
        prompt_original: str,
        partial_chunks: List[str],
        force_synthesis: bool,
        trace_id: str,
        max_tokens: int,
        temperature: float,
        top_p: float,
    ) -> DocumentAssemblerResult:
        assembly = self.response_assembly_service.assemble(
            mode=mode,
            prompt_original=prompt_original,
            partial_chunks=partial_chunks,
            force_synthesis=force_synthesis,
            trace_id=trace_id,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
        )
        return DocumentAssemblerResult(text=assembly.text, used_synthesis=assembly.used_synthesis)
