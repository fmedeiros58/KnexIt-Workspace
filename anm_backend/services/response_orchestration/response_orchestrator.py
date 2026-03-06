"""
FILE: services/response_orchestration/response_orchestrator.py
RESPONSIBILITY: Execute multi-step response orchestration with secondary process memory.
FLOW ROLE: Shared emission pipeline for chat and write modes.
READS: Main-mode context, orchestration config and generation policies.
RAM WRITES: Short-lived secondary process memory state only.
PERSISTS: No durable persistence; temporary in-memory TTL sessions.
PRIMARY RISK: Poor stop criteria may increase cost or reduce response quality.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from time import perf_counter
from typing import Any, Dict, List

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.audit import audit_log
from anm_backend.services.response_orchestration.chunk_compression_service import ChunkCompressionService
from anm_backend.services.response_orchestration.chunk_generation_service import ChunkGenerationService
from anm_backend.services.response_orchestration.config import (
    contradiction_check_enabled,
    force_final_synthesis,
    is_secondary_process_memory_enabled,
    resolve_redundancy_threshold,
)
from anm_backend.services.response_orchestration.continuity_guard_service import ContinuityGuardService
from anm_backend.services.response_orchestration.contradiction_guard_service import ContradictionGuardService
from anm_backend.services.response_orchestration.emission_planner_service import EmissionPlannerService
from anm_backend.services.response_orchestration.redundancy_guard_service import RedundancyGuardService
from anm_backend.services.response_orchestration.response_assembly_service import ResponseAssemblyService
from anm_backend.services.response_orchestration.secondary_process_memory_service import SecondaryProcessMemoryService
from anm_backend.services.response_orchestration.types import (
    OrchestrationRequest,
    OrchestrationResult,
)


def _normalize(value: str) -> str:
    return str(value or "").strip()


def _merge_unique(base: List[str], incoming: List[str], *, limit: int) -> List[str]:
    result = list(base)
    seen = {item for item in result if item}
    for item in incoming:
        clean = str(item or "").strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        result.append(clean)
        if len(result) >= max(1, limit):
            break
    return result[: max(1, limit)]


@dataclass
class ResponseOrchestrator:
    llm_adapter: LLMAdapter
    secondary_memory_service: SecondaryProcessMemoryService = field(default_factory=SecondaryProcessMemoryService)
    planner_service: EmissionPlannerService = field(default_factory=EmissionPlannerService)
    chunk_generation_service: ChunkGenerationService = field(init=False)
    chunk_compression_service: ChunkCompressionService = field(default_factory=ChunkCompressionService)
    continuity_guard_service: ContinuityGuardService = field(default_factory=ContinuityGuardService)
    redundancy_guard_service: RedundancyGuardService = field(default_factory=RedundancyGuardService)
    contradiction_guard_service: ContradictionGuardService = field(init=False)
    response_assembly_service: ResponseAssemblyService = field(init=False)

    def __post_init__(self) -> None:
        self.chunk_generation_service = ChunkGenerationService(llm_adapter=self.llm_adapter)
        self.contradiction_guard_service = ContradictionGuardService(enabled=contradiction_check_enabled())
        self.response_assembly_service = ResponseAssemblyService(llm_adapter=self.llm_adapter)

    def orchestrate(self, *, request: OrchestrationRequest) -> OrchestrationResult:
        trace_id = request.request_id
        started = perf_counter()
        self.secondary_memory_service.cleanup_expired()

        orchestration_enabled = is_secondary_process_memory_enabled(request.mode)
        plan = self.planner_service.plan(request=request, orchestration_enabled=orchestration_enabled)
        session = self.secondary_memory_service.start_session(request=request, plan=plan, trace_id=trace_id)

        audit_log(
            component="response_orchestrator",
            event="orchestration_started",
            payload={
                "request_id": request.request_id,
                "session_id": session.session_id,
                "mode": request.mode,
                "response_mode": plan.response_mode,
                "orchestration_enabled": orchestration_enabled,
                "max_cycles": plan.max_cycles,
                "min_cycles_required": plan.min_cycles_required,
                "target_chunk_tokens": plan.target_chunk_tokens,
                "max_total_response_tokens": plan.max_total_response_tokens,
                "continued_from_session_id": session.continued_from_session_id,
            },
            trace_id=trace_id,
        )

        models_used: List[str] = []
        usage: Dict[str, Any] = {"completion_tokens": 0}
        fallback_used = False
        redundancy_events = 0
        contradiction_events = 0
        stop_reason = "completed"

        if not plan.should_use_multi_pass:
            response = self.chunk_generation_service.generate_single_pass(
                request=request,
                plan=plan,
                trace_id=trace_id,
            )
            response_text = _normalize(response.text)
            if not response_text:
                raise RuntimeError("orchestration_single_pass_empty_response")
            model_name = _normalize(response.model)
            if model_name:
                models_used.append(model_name)
            completion_tokens = self.chunk_generation_service.completion_tokens(response)
            usage["completion_tokens"] = int(usage["completion_tokens"]) + completion_tokens

            compression = self.chunk_compression_service.compress(chunk_text=response_text)
            completed_step = session.pending_steps[0] if session.pending_steps else None
            session = self.secondary_memory_service.append_cycle_chunk(
                session_id=session.session_id,
                chunk_text=response_text,
                chunk_summary=compression.summary,
                tokens_consumed=completion_tokens,
                completed_step=completed_step,
                continuity_bridge=compression.continuity_bridge,
                local_decision="single_pass_generated",
                redundancy_score=0.0,
            )
            session.key_claims_established = _merge_unique(
                session.key_claims_established,
                compression.key_claims,
                limit=32,
            )
            session.forbidden_repetitions = _merge_unique(
                session.forbidden_repetitions,
                compression.forbidden_repetition_hints,
                limit=64,
            )
            session.open_loops = _merge_unique(session.open_loops, compression.open_loops, limit=16)
            stop_reason = "single_pass"
            session.stop_reason = stop_reason
            session = self.secondary_memory_service.save_session(state=session)
        else:
            response_text = ""
            for cycle_index in range(1, plan.max_cycles + 1):
                session = self.secondary_memory_service.get_session(session_id=session.session_id) or session
                step_label = session.pending_steps[0] if session.pending_steps else f"step_{cycle_index}"
                remaining_tokens = int(plan.max_total_response_tokens) - int(session.token_budget_consumed)
                if remaining_tokens < 64:
                    stop_reason = "token_budget_exhausted"
                    break
                cycle_max_tokens = max(
                    64,
                    min(
                        int(plan.target_chunk_tokens),
                        int(request.max_tokens),
                        int(remaining_tokens),
                    ),
                )
                cycle_trace_id = f"{trace_id}-c{cycle_index}"

                try:
                    generated = self.chunk_generation_service.generate_cycle_chunk(
                        request=request,
                        plan=plan,
                        state=session,
                        step_label=step_label,
                        cycle_index=cycle_index,
                        trace_id=cycle_trace_id,
                        max_tokens=cycle_max_tokens,
                    )
                except Exception as error:  # noqa: BLE001
                    if session.partial_chunks:
                        stop_reason = "cycle_error_partial"
                        session.local_decisions.append(f"cycle_error:{error}")
                        session = self.secondary_memory_service.save_session(state=session)
                        break
                    if request.allow_single_pass_fallback:
                        fallback_response = self.chunk_generation_service.generate_single_pass(
                            request=request,
                            plan=plan,
                            trace_id=f"{trace_id}-fallback",
                        )
                        response_text = _normalize(fallback_response.text)
                        if not response_text:
                            raise RuntimeError("orchestration_fallback_empty_response") from error
                        completion_tokens = self.chunk_generation_service.completion_tokens(fallback_response)
                        usage["completion_tokens"] = int(usage["completion_tokens"]) + completion_tokens
                        if fallback_response.model:
                            models_used.append(_normalize(fallback_response.model))
                        compression = self.chunk_compression_service.compress(chunk_text=response_text)
                        completed_step = session.pending_steps[0] if session.pending_steps else None
                        session = self.secondary_memory_service.append_cycle_chunk(
                            session_id=session.session_id,
                            chunk_text=response_text,
                            chunk_summary=compression.summary,
                            tokens_consumed=completion_tokens,
                            completed_step=completed_step,
                            continuity_bridge=compression.continuity_bridge,
                            local_decision="single_pass_fallback_after_cycle_error",
                            redundancy_score=0.0,
                        )
                        fallback_used = True
                        stop_reason = "single_pass_fallback_after_cycle_error"
                        break
                    raise

                chunk_text = _normalize(generated.text)
                if not chunk_text:
                    stop_reason = "empty_chunk_generated"
                    break

                completion_tokens = self.chunk_generation_service.completion_tokens(generated)
                usage["completion_tokens"] = int(usage["completion_tokens"]) + completion_tokens
                model_name = _normalize(generated.model)
                if model_name:
                    models_used.append(model_name)

                redundancy = self.redundancy_guard_service.evaluate(
                    candidate_chunk=chunk_text,
                    previous_chunks=session.partial_chunks,
                    threshold=resolve_redundancy_threshold(),
                )
                continuity = self.continuity_guard_service.evaluate(
                    candidate_chunk=chunk_text,
                    cycle_index=cycle_index,
                )
                contradiction = self.contradiction_guard_service.evaluate(
                    candidate_chunk=chunk_text,
                    key_claims=session.key_claims_established,
                )

                if not redundancy.passed:
                    redundancy_events += 1
                if not contradiction.passed:
                    contradiction_events += 1

                reached_min_cycles = session.cycle_count >= max(1, int(plan.min_cycles_required))
                if contradiction.should_stop:
                    stop_reason = contradiction.reason
                    session.contradiction_flags = _merge_unique(
                        session.contradiction_flags,
                        [contradiction.reason],
                        limit=16,
                    )
                    session = self.secondary_memory_service.save_session(state=session)
                    break
                if redundancy.should_stop and session.cycle_count > 0 and reached_min_cycles:
                    stop_reason = redundancy.reason
                    session.local_decisions.append(f"stopped_due_to:{redundancy.reason}")
                    session = self.secondary_memory_service.save_session(state=session)
                    break
                if redundancy.should_stop and session.cycle_count > 0 and not reached_min_cycles:
                    session.local_decisions.append(
                        f"redundancy_stop_deferred_until_min_cycles:{plan.min_cycles_required}"
                    )

                compression = self.chunk_compression_service.compress(chunk_text=chunk_text)
                completed_step = step_label if step_label in session.pending_steps else None
                session = self.secondary_memory_service.append_cycle_chunk(
                    session_id=session.session_id,
                    chunk_text=chunk_text,
                    chunk_summary=compression.summary,
                    tokens_consumed=completion_tokens,
                    completed_step=completed_step,
                    continuity_bridge=compression.continuity_bridge,
                    local_decision=f"cycle_{cycle_index}_accepted",
                    redundancy_score=redundancy.score,
                )
                session.key_claims_established = _merge_unique(
                    session.key_claims_established,
                    compression.key_claims,
                    limit=40,
                )
                session.forbidden_repetitions = _merge_unique(
                    session.forbidden_repetitions,
                    compression.forbidden_repetition_hints,
                    limit=72,
                )
                session.open_loops = _merge_unique(session.open_loops, compression.open_loops, limit=20)
                if not continuity.passed:
                    session.local_decisions.append(f"continuity_warning:{continuity.reason}")
                session = self.secondary_memory_service.save_session(state=session)

                if session.cycle_count >= plan.max_cycles:
                    stop_reason = "max_cycles_reached"
                    break
                if session.token_budget_consumed >= plan.max_total_response_tokens:
                    stop_reason = "token_budget_exhausted"
                    break
                if not session.pending_steps and session.cycle_count >= max(1, int(plan.min_cycles_required)):
                    stop_reason = "coverage_reached"
                    break
                semantic_gain = float(redundancy.details.get("semantic_gain", 1.0)) if redundancy.details else 1.0
                if semantic_gain < 0.10 and session.cycle_count >= max(2, int(plan.min_cycles_required)):
                    stop_reason = "semantic_stagnation"
                    break

            session = self.secondary_memory_service.get_session(session_id=session.session_id) or session
            if not response_text:
                assembly = self.response_assembly_service.assemble(
                    mode=request.mode,
                    prompt_original=request.prompt_original,
                    partial_chunks=session.partial_chunks,
                    force_synthesis=force_final_synthesis(),
                    trace_id=f"{trace_id}-assembly",
                    max_tokens=max(96, min(int(request.max_tokens), int(plan.max_total_response_tokens))),
                    temperature=min(0.4, max(0.0, float(request.temperature))),
                    top_p=float(request.top_p),
                )
                response_text = _normalize(assembly.text)
                if not response_text and request.allow_single_pass_fallback:
                    fallback_response = self.chunk_generation_service.generate_single_pass(
                        request=request,
                        plan=plan,
                        trace_id=f"{trace_id}-fallback-assembly",
                    )
                    response_text = _normalize(fallback_response.text)
                    if fallback_response.model:
                        models_used.append(_normalize(fallback_response.model))
                    usage["completion_tokens"] = int(usage["completion_tokens"]) + self.chunk_generation_service.completion_tokens(
                        fallback_response
                    )
                    fallback_used = True
                    stop_reason = "single_pass_fallback_after_empty_assembly"
                elif assembly.used_synthesis:
                    session.local_decisions.append("assembly_llm_synthesis_used")
                    session = self.secondary_memory_service.save_session(state=session)

        if not response_text:
            raise RuntimeError("response_orchestration_empty_result")

        session = self.secondary_memory_service.finalize_session(
            session_id=session.session_id,
            stop_reason=stop_reason,
            trace_id=trace_id,
        ) or session

        duration_ms = int((perf_counter() - started) * 1000)
        models_used = [model for model in _merge_unique([], models_used, limit=12) if model]
        result = OrchestrationResult(
            request_id=request.request_id,
            session_id=session.session_id,
            mode=request.mode,
            response_mode=plan.response_mode if not fallback_used else "single_pass_fallback",
            response_text=response_text,
            cycle_count=max(1, int(session.cycle_count)),
            stop_reason=stop_reason,
            token_budget_consumed=max(0, int(session.token_budget_consumed)),
            fallback_used=bool(fallback_used),
            partial_chunks=list(session.partial_chunks),
            chunk_summaries=list(session.chunk_summaries),
            redundancy_events=redundancy_events,
            contradiction_events=contradiction_events,
            total_duration_ms=duration_ms,
            models_used=models_used,
            usage=dict(usage),
            telemetry={
                "plan": {
                    "response_mode": plan.response_mode,
                    "should_use_multi_pass": plan.should_use_multi_pass,
                    "complexity_score": plan.complexity_score,
                    "max_cycles": plan.max_cycles,
                    "min_cycles_required": plan.min_cycles_required,
                    "target_chunk_tokens": plan.target_chunk_tokens,
                    "max_total_response_tokens": plan.max_total_response_tokens,
                    "rationale": list(plan.rationale),
                },
                "session": {
                    "session_id": session.session_id,
                    "continued_from_session_id": session.continued_from_session_id,
                    "estimated_coverage": session.estimated_coverage,
                    "completed_steps": list(session.completed_steps),
                    "pending_steps": list(session.pending_steps),
                },
                "fallback_used": bool(fallback_used),
            },
        )

        audit_log(
            component="response_orchestrator",
            event="orchestration_completed",
            payload={
                "request_id": request.request_id,
                "session_id": session.session_id,
                "mode": request.mode,
                "response_mode": result.response_mode,
                "cycle_count": result.cycle_count,
                "stop_reason": result.stop_reason,
                "min_cycles_required": plan.min_cycles_required,
                "token_budget_consumed": result.token_budget_consumed,
                "redundancy_events": redundancy_events,
                "contradiction_events": contradiction_events,
                "fallback_used": bool(fallback_used),
                "duration_ms": duration_ms,
            },
            trace_id=trace_id,
        )
        return result
