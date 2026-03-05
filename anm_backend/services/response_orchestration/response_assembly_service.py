"""
FILE: services/response_orchestration/response_assembly_service.py
RESPONSIBILITY: Consolidate partial chunks into one final coherent response.
FLOW ROLE: Final synthesis and deduplication before returning to API pipeline.
READS: Generated chunk list and orchestration metadata.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Losing nuance if aggressive deduplication is applied.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Dict, List

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.utils import describe_language, detect_user_language


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _canonical(value: str) -> str:
    return _normalize(value).lower()


def _should_use_system_role() -> bool:
    return str(os.getenv("ANM_ENGINE_USE_SYSTEM_ROLE", "0")).strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class AssemblyResult:
    text: str
    used_synthesis: bool
    metadata: Dict[str, object]


@dataclass
class ResponseAssemblyService:
    llm_adapter: LLMAdapter

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
    ) -> AssemblyResult:
        deterministic = self._deterministic_assembly(partial_chunks=partial_chunks)
        response_language = detect_user_language(prompt_original)
        language_label = describe_language(response_language)
        if not force_synthesis or len(partial_chunks) <= 1:
            return AssemblyResult(
                text=deterministic,
                used_synthesis=False,
                metadata={"source": "deterministic", "chunk_count": len(partial_chunks)},
            )

        try:
            synthesis_prompt = self._build_synthesis_prompt(
                mode=mode,
                prompt_original=prompt_original,
                partial_chunks=partial_chunks,
            )
            system_instruction = (
                "Consolide blocos parciais em uma resposta unica, fluida e sem repeticao. "
                "Nao mencione processo interno. "
                f"Idioma obrigatorio da resposta: {language_label} ({response_language}). "
                "Nao troque de idioma sem pedido explicito."
            )
            if _should_use_system_role():
                messages = [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": synthesis_prompt},
                ]
            else:
                messages = [{"role": "user", "content": f"{system_instruction}\n\n{synthesis_prompt}".strip()}]
            request = self.llm_adapter.engine_client.build_request(
                messages=messages,
                max_tokens=max(96, int(max_tokens)),
                temperature=max(0.0, min(float(temperature), 1.0)),
                top_p=max(0.1, min(float(top_p), 1.0)),
                trace_id=trace_id,
                metadata={"anm_orchestration": {"stage": "final_synthesis", "mode": mode}},
            )
            raw = self.llm_adapter.engine_client.invoke(
                self.llm_adapter.engine_client.engine_request_to_payload(request),
                trace_id=trace_id,
            )
            parsed = self.llm_adapter.response_parser.parse(raw, trace_id=trace_id)
            synthesized = _normalize(parsed.text)
            if synthesized:
                return AssemblyResult(
                    text=synthesized,
                    used_synthesis=True,
                    metadata={"source": "llm_synthesis", "chunk_count": len(partial_chunks), "model": parsed.model},
                )
        except Exception:  # noqa: BLE001
            pass

        return AssemblyResult(
            text=deterministic,
            used_synthesis=False,
            metadata={"source": "deterministic_fallback", "chunk_count": len(partial_chunks)},
        )

    def _deterministic_assembly(self, *, partial_chunks: List[str]) -> str:
        paragraphs: List[str] = []
        seen = set()
        for chunk in partial_chunks:
            parts = [item.strip() for item in re.split(r"\n\s*\n+", str(chunk or "").strip()) if item.strip()]
            for paragraph in parts:
                key = _canonical(paragraph)
                if not key:
                    continue
                if key in seen:
                    continue
                seen.add(key)
                paragraphs.append(paragraph)
        return "\n\n".join(paragraphs).strip()

    def _build_synthesis_prompt(self, *, mode: str, prompt_original: str, partial_chunks: List[str]) -> str:
        language_tag = detect_user_language(prompt_original)
        language_label = describe_language(language_tag)
        joined_chunks = "\n\n".join(f"[CHUNK {idx + 1}]\n{chunk}" for idx, chunk in enumerate(partial_chunks))
        return (
            f"Modo: {mode}\n"
            f"Idioma obrigatorio da resposta final: {language_label} ({language_tag})\n"
            f"Prompt original: {_normalize(prompt_original)}\n\n"
            "Blocos gerados:\n"
            f"{joined_chunks}\n\n"
            "Tarefa:\n"
            "- Entregar uma unica resposta final coesa.\n"
            "- Remover redundancia entre blocos.\n"
            "- Preservar continuidade e voz unica.\n"
        )
