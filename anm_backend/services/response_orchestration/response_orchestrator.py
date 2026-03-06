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
from anm_backend.services.response_orchestration.chunk_orchestrator_service import ChunkOrchestratorService
from anm_backend.services.response_orchestration.chunk_generation_service import ChunkGenerationService
from anm_backend.services.response_orchestration.clarification_repair_manager_service import (
    ClarificationRepairManagerService,
)
from anm_backend.services.response_orchestration.compression_engine_service import CompressionEngineService
from anm_backend.services.response_orchestration.config import (
    contradiction_check_enabled,
    force_final_synthesis,
    is_secondary_process_memory_enabled,
    resolve_redundancy_threshold,
)
from anm_backend.services.response_orchestration.document_assembler_service import DocumentAssemblerService
from anm_backend.services.response_orchestration.dialogue_state_manager_service import DialogueStateManagerService
from anm_backend.services.response_orchestration.continuity_bridge_service import ContinuityBridgeService
from anm_backend.services.response_orchestration.continuity_guard_service import ContinuityGuardService
from anm_backend.services.response_orchestration.contradiction_guard_service import ContradictionGuardService
from anm_backend.services.response_orchestration.emission_planner_service import EmissionPlannerService
from anm_backend.services.response_orchestration.inference_engine_service import InferenceEngineService
from anm_backend.services.response_orchestration.micro_assembler_service import MicroAssemblerService
from anm_backend.services.response_orchestration.paragraph_segmenter_service import ParagraphSegmenterService
from anm_backend.services.response_orchestration.process_memory_manager_service import ProcessMemoryManagerService
from anm_backend.services.response_orchestration.reflective_analyzer_service import ReflectiveAnalyzerService
from anm_backend.services.response_orchestration.redundancy_guard_service import RedundancyGuardService
from anm_backend.services.response_orchestration.response_critic_service import ResponseCriticService
from anm_backend.services.response_orchestration.response_assembly_service import ResponseAssemblyService
from anm_backend.services.response_orchestration.secondary_process_memory_service import SecondaryProcessMemoryService
from anm_backend.services.response_orchestration.semantic_controller_service import SemanticControllerService
from anm_backend.services.response_orchestration.turn_planner_service import TurnPlannerService
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
    chunk_orchestrator_service: ChunkOrchestratorService = field(default_factory=ChunkOrchestratorService)
    paragraph_segmenter_service: ParagraphSegmenterService = field(default_factory=ParagraphSegmenterService)
    continuity_bridge_service: ContinuityBridgeService = field(default_factory=ContinuityBridgeService)
    micro_assembler_service: MicroAssemblerService = field(default_factory=MicroAssemblerService)
    compression_engine_service: CompressionEngineService = field(default_factory=CompressionEngineService)
    semantic_controller_service: SemanticControllerService = field(default_factory=SemanticControllerService)
    reflective_analyzer_service: ReflectiveAnalyzerService = field(default_factory=ReflectiveAnalyzerService)
    inference_engine_service: InferenceEngineService = field(default_factory=InferenceEngineService)
    process_memory_manager_service: ProcessMemoryManagerService = field(default_factory=ProcessMemoryManagerService)
    response_critic_service: ResponseCriticService = field(default_factory=ResponseCriticService)
    clarification_repair_manager_service: ClarificationRepairManagerService = field(
        default_factory=ClarificationRepairManagerService
    )
    dialogue_state_manager_service: DialogueStateManagerService = field(default_factory=DialogueStateManagerService)
    turn_planner_service: TurnPlannerService = field(default_factory=TurnPlannerService)
    chunk_generation_service: ChunkGenerationService = field(init=False)
    chunk_compression_service: ChunkCompressionService = field(default_factory=ChunkCompressionService)
    continuity_guard_service: ContinuityGuardService = field(default_factory=ContinuityGuardService)
    redundancy_guard_service: RedundancyGuardService = field(default_factory=RedundancyGuardService)
    contradiction_guard_service: ContradictionGuardService = field(init=False)
    response_assembly_service: ResponseAssemblyService = field(init=False)
    document_assembler_service: DocumentAssemblerService = field(init=False)

    def __post_init__(self) -> None:
        self.chunk_generation_service = ChunkGenerationService(llm_adapter=self.llm_adapter)
        self.contradiction_guard_service = ContradictionGuardService(enabled=contradiction_check_enabled())
        self.response_assembly_service = ResponseAssemblyService(llm_adapter=self.llm_adapter)
        self.document_assembler_service = DocumentAssemblerService(
            response_assembly_service=self.response_assembly_service
        )

    def orchestrate(self, *, request: OrchestrationRequest) -> OrchestrationResult:
        trace_id = request.request_id
        started = perf_counter()
        self.secondary_memory_service.cleanup_expired()

        orchestration_enabled = is_secondary_process_memory_enabled(request.mode)
        plan = self.planner_service.plan(request=request, orchestration_enabled=orchestration_enabled)
        phase0_decision = self.paragraph_segmenter_service.decide(request=request, base_plan=plan)
        plan = self.paragraph_segmenter_service.apply_to_plan(base_plan=plan, decision=phase0_decision)
        call_plan = self.chunk_orchestrator_service.build_call_plan(plan=plan)
        repair_strategy = self.clarification_repair_manager_service.decide(
            prompt_original=request.prompt_original,
        )
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
                "phase0_enabled": plan.phase0_enabled,
                "phase0_call_count": plan.phase0_call_count,
                "phase0_open_connector": plan.phase0_open_connector,
                "call_plan": call_plan,
                "repair_strategy": {
                    "mode": repair_strategy.mode,
                    "reason": repair_strategy.reason,
                    "should_ask_clarification": repair_strategy.should_ask_clarification,
                },
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
            progressive_compression = self.compression_engine_service.compress(
                session=session,
                latest_chunk=response_text,
                latest_summary=compression.summary,
            )
            semantic_control = self.semantic_controller_service.decide(
                plan=plan,
                session=session,
                cycle_index=1,
                redundancy_score=0.0,
            )
            reflective_report = self.reflective_analyzer_service.analyze(
                prompt_original=request.prompt_original,
                previous_chunks=list(session.partial_chunks),
                candidate_chunk=response_text,
            )
            inference_map = self.inference_engine_service.infer(
                prompt_original=request.prompt_original,
                rolling_summary=progressive_compression.rolling_summary,
                next_intent=semantic_control.next_intent,
                open_loops=list(session.open_loops),
            )
            process_update = self.process_memory_manager_service.build_update(
                compression=progressive_compression,
                semantic=semantic_control,
                reflective=reflective_report,
                inference=inference_map,
            )
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
                rolling_summary=process_update.rolling_summary,
                compressed_state=process_update.compressed_state,
                semantic_state=process_update.semantic_state,
                next_intent=process_update.next_intent,
                semantic_direction=process_update.semantic_direction,
                continuity_rule=process_update.continuity_rule,
                reflective_report=process_update.reflective_report,
                inference_map=process_update.inference_map,
                redundancy_flags=process_update.redundancy_flags,
            )
            session.local_decisions.extend(process_update.local_decisions)
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

                phase0_bridge_state = None
                if plan.phase0_enabled and int(plan.phase0_call_count) >= 2 and cycle_index == 1:
                    phase0_bridge_state = self.continuity_bridge_service.prepare_first_chunk(
                        first_chunk=chunk_text,
                        preferred_connector=session.phase0_open_connector or plan.phase0_open_connector,
                        join_rule=session.join_rule or plan.phase0_join_rule,
                    )
                    chunk_text = _normalize(phase0_bridge_state.first_chunk)

                phase0_restart_detected = bool(
                    plan.phase0_enabled
                    and int(plan.phase0_call_count) >= 2
                    and cycle_index >= 2
                    and self.continuity_bridge_service.detect_artificial_restart(continuation_chunk=chunk_text)
                )

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
                progressive_compression = self.compression_engine_service.compress(
                    session=session,
                    latest_chunk=chunk_text,
                    latest_summary=compression.summary,
                )
                semantic_control = self.semantic_controller_service.decide(
                    plan=plan,
                    session=session,
                    cycle_index=cycle_index,
                    redundancy_score=redundancy.score,
                )
                reflective_report = self.reflective_analyzer_service.analyze(
                    prompt_original=request.prompt_original,
                    previous_chunks=list(session.partial_chunks),
                    candidate_chunk=chunk_text,
                )
                inference_map = self.inference_engine_service.infer(
                    prompt_original=request.prompt_original,
                    rolling_summary=progressive_compression.rolling_summary,
                    next_intent=semantic_control.next_intent,
                    open_loops=list(session.open_loops),
                )
                process_update = self.process_memory_manager_service.build_update(
                    compression=progressive_compression,
                    semantic=semantic_control,
                    reflective=reflective_report,
                    inference=inference_map,
                )
                completed_step = step_label if step_label in session.pending_steps else None
                continuity_bridge_value = compression.continuity_bridge
                if phase0_bridge_state is not None:
                    continuity_bridge_value = phase0_bridge_state.continuation_anchor
                session = self.secondary_memory_service.append_cycle_chunk(
                    session_id=session.session_id,
                    chunk_text=chunk_text,
                    chunk_summary=compression.summary,
                    tokens_consumed=completion_tokens,
                    completed_step=completed_step,
                    continuity_bridge=continuity_bridge_value,
                    local_decision=f"cycle_{cycle_index}_accepted",
                    redundancy_score=redundancy.score,
                    rolling_summary=process_update.rolling_summary,
                    compressed_state=process_update.compressed_state,
                    semantic_state=process_update.semantic_state,
                    next_intent=process_update.next_intent,
                    semantic_direction=process_update.semantic_direction,
                    continuity_rule=process_update.continuity_rule,
                    reflective_report=process_update.reflective_report,
                    inference_map=process_update.inference_map,
                    redundancy_flags=process_update.redundancy_flags,
                )
                if phase0_bridge_state is not None:
                    session.first_chunk = phase0_bridge_state.first_chunk
                    session.continuation_anchor = phase0_bridge_state.continuation_anchor
                    session.join_rule = phase0_bridge_state.join_rule
                    session.phase0_open_connector = phase0_bridge_state.connector_used
                    if phase0_bridge_state.injected_connector:
                        session.local_decisions.append("phase0_open_connector_injected")
                session.local_decisions.extend(process_update.local_decisions)
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
                if phase0_restart_detected:
                    session.local_decisions.append("phase0_restart_prefix_detected")
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
                if plan.phase0_enabled and int(plan.phase0_call_count) == 2 and len(session.partial_chunks) >= 2:
                    response_text = _normalize(
                        self.micro_assembler_service.assemble_paragraph(
                            first_chunk=session.first_chunk or session.partial_chunks[0],
                            continuation_chunk=session.partial_chunks[1],
                            continuation_anchor=session.continuation_anchor,
                            join_rule=session.join_rule or plan.phase0_join_rule,
                        )
                    )
                    session.local_decisions.append("phase0_micro_assembler_used")
                    session = self.secondary_memory_service.save_session(state=session)
                else:
                    assembly = self.document_assembler_service.assemble(
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

        response_check = self.response_critic_service.evaluate(
            prompt_original=request.prompt_original,
            response_text=response_text,
        )
        if not response_check.passed:
            session.local_decisions.append("response_critic_not_passed")
            session.local_decisions.extend([f"response_critic:{item}" for item in response_check.findings])
            session = self.secondary_memory_service.save_session(state=session)

        session = self.secondary_memory_service.finalize_session(
            session_id=session.session_id,
            stop_reason=stop_reason,
            trace_id=trace_id,
        ) or session

        duration_ms = int((perf_counter() - started) * 1000)
        models_used = [model for model in _merge_unique([], models_used, limit=12) if model]
        effective_response_mode = plan.response_mode if not fallback_used else "single_pass_fallback"
        dialogue_state = self.dialogue_state_manager_service.project_state(
            prompt_original=request.prompt_original,
            next_intent=session.next_intent,
            response_mode=effective_response_mode,
        )
        turn_function = self.turn_planner_service.plan_next_turn(
            response_check_passed=response_check.passed,
            next_intent=session.next_intent,
        )
        result = OrchestrationResult(
            request_id=request.request_id,
            session_id=session.session_id,
            mode=request.mode,
            response_mode=effective_response_mode,
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
                    "phase0": {
                        "enabled": bool(plan.phase0_enabled),
                        "call_count": int(plan.phase0_call_count),
                        "segment_goal": plan.phase0_segment_goal,
                        "target_style": plan.phase0_target_style,
                        "join_rule": plan.phase0_join_rule,
                        "open_connector": plan.phase0_open_connector,
                        "first_chunk_min_tokens": int(plan.phase0_first_chunk_min_tokens),
                        "first_chunk_max_tokens": int(plan.phase0_first_chunk_max_tokens),
                        "per_call_max_tokens": int(plan.phase0_per_call_max_tokens),
                        "decision_density_score": float(phase0_decision.density_score),
                        "decision_rationale": list(phase0_decision.rationale),
                    },
                    "call_plan": call_plan,
                },
                "session": {
                    "session_id": session.session_id,
                    "continued_from_session_id": session.continued_from_session_id,
                    "estimated_coverage": session.estimated_coverage,
                    "completed_steps": list(session.completed_steps),
                    "pending_steps": list(session.pending_steps),
                    "rolling_summary": session.rolling_summary,
                    "next_intent": session.next_intent,
                    "semantic_direction": session.semantic_direction,
                    "redundancy_flags": list(session.redundancy_flags),
                },
                "response_check": {
                    "passed": bool(response_check.passed),
                    "score": float(response_check.score),
                    "findings": list(response_check.findings),
                },
                "repair_strategy": {
                    "mode": repair_strategy.mode,
                    "reason": repair_strategy.reason,
                    "should_ask_clarification": repair_strategy.should_ask_clarification,
                },
                "dialogue_state": {
                    "active_theme": dialogue_state.active_theme,
                    "open_subtopics": list(dialogue_state.open_subtopics),
                    "discourse_tone": dialogue_state.discourse_tone,
                    "metadata": dict(dialogue_state.metadata),
                },
                "turn_function": {
                    "name": turn_function.function_name,
                    "rationale": turn_function.rationale,
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
                "phase0_enabled": bool(plan.phase0_enabled),
                "phase0_call_count": int(plan.phase0_call_count),
                "response_check_passed": bool(response_check.passed),
                "response_check_score": float(response_check.score),
                "turn_function": turn_function.function_name,
            },
            trace_id=trace_id,
        )
        return result
