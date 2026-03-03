"""
FILE: write/continue_prompt_builder.py
RESPONSIBILITY: Centralized and auditable prompt assembly for /write/continue.
FLOW ROLE: Build one deterministic context pack prompt with anti-redundancy rules.
READS: Context pack payload from write continue service.
RAM WRITES: Temporary prompt string.
PERSISTS: None.
PRIMARY RISK: Excessive context size can pressure token budget if limits are not enforced.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


def _truncate(value: str, *, max_chars: int) -> str:
    text = str(value or "").strip()
    if len(text) <= max_chars:
        return text
    return text[: max(8, max_chars - 3)].rstrip() + "..."


@dataclass(frozen=True)
class RetrievedChunkContext:
    chunk_id: str
    section_id: str
    chunk_order: int
    version: int
    similarity: float
    text: str


@dataclass(frozen=True)
class RetrievedMemoryContext:
    memory_id: str
    memory_type: str
    title: str
    content: str
    priority: int
    similarity: float


@dataclass(frozen=True)
class ContinueWritingContextPack:
    project_id: str
    project_title: str
    project_objective: str
    target_section_id: str
    target_section_title: str
    target_section_order: int
    target_section_status: str
    target_section_objective: str
    target_section_outline_notes: str
    instruction: str
    section_summary: Optional[str]
    project_global_summary: Optional[str]
    retrieved_chunks: List[RetrievedChunkContext] = field(default_factory=list)
    retrieved_memories: List[RetrievedMemoryContext] = field(default_factory=list)
    paragraphs_min: int = 2
    paragraphs_max: int = 4


@dataclass(frozen=True)
class ContinueWritingPromptBuilder:
    max_section_summary_chars: int = 1800
    max_global_summary_chars: int = 2200
    max_chunk_chars: int = 900
    max_memory_chars: int = 600

    def build_prompt(self, pack: ContinueWritingContextPack) -> str:
        anti_redundancy_rules = [
            "Nao repetir trechos ja cobertos no historico.",
            "Se um tema ja apareceu, avance com novo angulo, evidencias ou aprofundamento.",
            "Nao contradizer decisoes, restricoes e terminologia registradas.",
            "Respeitar objetivo e status da secao alvo.",
            "Gerar somente o proximo bloco, sem reescrever o documento inteiro.",
        ]

        lines: List[str] = [
            "MODO ESCRITA - CONTINUE WRITING (AUDITAVEL)",
            "",
            "[ALVO DE ESCRITA]",
            f"- Projeto: {pack.project_title} (id={pack.project_id})",
            f"- Objetivo do projeto: {_truncate(pack.project_objective or 'Nao informado.', max_chars=500)}",
            (
                f"- Secao alvo: {pack.target_section_title} "
                f"(id={pack.target_section_id}, ordem={pack.target_section_order}, status={pack.target_section_status})"
            ),
            f"- Objetivo da secao: {_truncate(pack.target_section_objective or 'Nao informado.', max_chars=500)}",
            f"- Outline notes: {_truncate(pack.target_section_outline_notes or 'Nao informado.', max_chars=700)}",
            f"- Instrucao do usuario: {_truncate(pack.instruction, max_chars=700)}",
            "",
            "[RESUMOS DE CONTEXTO]",
            f"- Resumo da secao: {_truncate(pack.section_summary or 'Nao disponivel.', max_chars=self.max_section_summary_chars)}",
            (
                f"- Resumo global do projeto: "
                f"{_truncate(pack.project_global_summary or 'Nao disponivel.', max_chars=self.max_global_summary_chars)}"
            ),
            "",
            "[MEMORIA DE PROCESSO RELEVANTE]",
        ]

        if pack.retrieved_memories:
            for memory in pack.retrieved_memories:
                lines.append(
                    (
                        f"- memory_id={memory.memory_id} type={memory.memory_type} priority={memory.priority} "
                        f"similarity={memory.similarity:.4f} title={_truncate(memory.title, max_chars=140)} | "
                        f"{_truncate(memory.content, max_chars=self.max_memory_chars)}"
                    )
                )
        else:
            lines.append("- Sem memoria de processo relevante recuperada para esta instrucao.")

        lines.extend(["", "[TRECHOS SEMELHANTES JA ESCRITOS]"])
        if pack.retrieved_chunks:
            for chunk in pack.retrieved_chunks:
                lines.append(
                    (
                        f"- chunk_id={chunk.chunk_id} section_id={chunk.section_id} "
                        f"order={chunk.chunk_order} version={chunk.version} similarity={chunk.similarity:.4f}: "
                        f"{_truncate(chunk.text, max_chars=self.max_chunk_chars)}"
                    )
                )
        else:
            lines.append("- Sem chunks semanticamente similares.")

        lines.extend(
            [
                "",
                "[REGRAS ANTI-REDUNDANCIA OBRIGATORIAS]",
            ]
        )
        for index, rule in enumerate(anti_redundancy_rules, start=1):
            lines.append(f"{index}. {rule}")

        lines.extend(
            [
                "",
                "[SAIDA ESPERADA]",
                (
                    f"- Entregar apenas o proximo bloco da secao alvo em {pack.paragraphs_min} a {pack.paragraphs_max} "
                    "paragrafos bem conectados."
                ),
                "- Sem introducoes meta sobre o processo.",
                "- Sem repetir listas de contexto ou ids na resposta final.",
                "- Produzir texto pronto para ser anexado ao manuscrito.",
            ]
        )
        return "\n".join(lines).strip()
