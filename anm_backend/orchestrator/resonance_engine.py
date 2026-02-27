"""
FILE: orchestrator/resonance_engine.py
RESPONSIBILITY: Execute bounded resonant propagation across nodules.
FLOW ROLE: Multi-cycle signal propagation with readiness-aware expansion control.
READS: Seed signal, registry, pathway graph, router, scheduler and contextual gate decisions.
RAM WRITES: Cortex activations/signals/trails and hypothesis pool updates.
PERSISTS: Traceable propagation trail through logs/checkpoints.
PRIMARY RISK: Runaway cycles if depth and convergence controls are not enforced.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List
from uuid import uuid4

from anm_backend.audit import audit_log
from anm_backend.contracts import Signal
from anm_backend.memory.ram_cortex import RamCortex
from anm_backend.orchestrator.contextual_plasticity_gate import ContextualGateDecision
from anm_backend.orchestrator.hypothesis_pool import Hypothesis, HypothesisPool
from anm_backend.orchestrator.nodule_registry import NoduleRegistry
from anm_backend.orchestrator.pathway_graph import PathwayGraph
from anm_backend.orchestrator.router import Router
from anm_backend.orchestrator.scheduler import Scheduler


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


@dataclass
class ResonanceEngine:
    """
    Objective:
        Propagate activation in bounded resonant waves.
    Responsibilities:
        Execute cycles, route signals, update hypotheses and stop on convergence.
    Limits:
        Does not collapse hypotheses or call external engine.
    Mutates:
        Cortex state and hypothesis pool.
    Must not:
        Ignore contextual plasticity gate limits.
    """

    registry: NoduleRegistry
    graph: PathwayGraph
    router: Router
    scheduler: Scheduler
    max_depth: int = 4
    convergence_epsilon: float = 0.02
    _signal_queue: Deque[Signal] = field(default_factory=lambda: deque(maxlen=512))
    _propagation_trail: Deque[Dict[str, object]] = field(default_factory=lambda: deque(maxlen=512))

    def run(
        self,
        *,
        seed_nodule_id: str,
        seed_strength: float,
        cortex: RamCortex,
        hypothesis_pool: HypothesisPool,
        gate_decision: ContextualGateDecision,
        trace_id: str,
        stimulus_metrics: Dict[str, float],
    ) -> List[Hypothesis]:
        """
        Purpose:
            Run resonant propagation starting from seed nodule.
        Parameters:
            seed_nodule_id: Initial nodule id.
            seed_strength: Initial signal strength.
            cortex: RAM cortex.
            hypothesis_pool: Hypothesis pool.
            gate_decision: Contextual gate decision.
            trace_id: Request trace id.
            stimulus_metrics: Metrics to forward to nodule readiness.
        Returns:
            List[Hypothesis]: Top hypotheses after resonance.
        Side Effects:
            Mutates cortex/hypothesis state and emits audit logs.
        RAM Impact:
            Core cognitive state mutation in RAM.
        Persistence Impact:
            Trail and state exported via snapshots.
        Expected Failures:
            None.
        """

        self.scheduler.clear()
        self._signal_queue.clear()
        self._propagation_trail.clear()

        depth_limit = min(self.max_depth, gate_decision.resonance_depth_limit)
        self.scheduler.push({"nodule_id": seed_nodule_id, "strength": seed_strength, "depth": 0, "cycle_id": 0}, priority=1.0)
        self._signal_queue.append(
            Signal(
                trace_id=trace_id,
                source_id=seed_nodule_id,
                target_id=seed_nodule_id,
                strength=seed_strength,
                depth=0,
                cycle_id=0,
            )
        )

        cycle = 0
        last_mean_output = 0.0
        while cycle < self.scheduler.max_cycles:
            task = self.scheduler.pop()
            if task is None:
                break

            nodule_id = str(task["nodule_id"])
            depth = int(task["depth"])
            cycle_id = int(task.get("cycle_id", cycle))
            strength = float(task["strength"])
            if depth > depth_limit:
                continue

            nodule = self.registry.get(nodule_id)
            if nodule is None:
                continue

            nodule.receive_input(strength, trace_id=trace_id)
            output = nodule.step(
                stimulus_metrics=stimulus_metrics,
                effective_learning_rate=gate_decision.effective_learning_rate,
                allow_structural=gate_decision.allow_structural_consolidation,
                trace_id=trace_id,
                cycle_id=cycle_id,
            )
            cortex.set_activation(nodule_id=nodule_id, level=output, cycle_id=cycle_id, reason="resonance")
            cortex.update_cycle_metadata(cycle_id=cycle_id, trace_id=trace_id)

            current_signal = Signal(
                trace_id=trace_id,
                source_id=nodule_id,
                target_id=nodule_id,
                strength=output,
                depth=depth,
                cycle_id=cycle_id,
                metadata={"phase": "nodule_output"},
            )
            self._signal_queue.append(current_signal)
            cortex.push_signal(current_signal)
            trail_entry = {
                "trace_id": trace_id,
                "cycle_id": cycle_id,
                "nodule_id": nodule_id,
                "depth": depth,
                "output": output,
                "timestamp": current_signal.timestamp,
            }
            self._propagation_trail.append(trail_entry)
            cortex.add_processing_trace(trace_id=trace_id, cycle_id=cycle_id, nodule_id=nodule_id, detail=trail_entry)

            hypothesis = Hypothesis(
                hypothesis_id=f"hyp-{uuid4()}",
                content=f"nodule={nodule_id} output={output:.4f}",
                score=output,
                probability=max(0.05, min(1.0, output)),
                cost=max(0.1, 1.2 - output),
                objective_fit=max(0.1, min(1.0, output + 0.2)),
                origin_nodule=nodule_id,
                stimulus_coherence=float(stimulus_metrics.get("stimulus_coherence", 0.5)),
                metadata={"cycle_id": cycle_id, "trace_id": trace_id},
            )
            hypothesis_pool.upsert(
                hypothesis,
                readiness_score=gate_decision.readiness_score,
                stimulus_coherence=float(stimulus_metrics.get("stimulus_coherence", 0.5)),
                trace_id=trace_id,
            )

            next_routes = self.router.route(nodule_id, self.graph, cortex)
            for route in next_routes:
                forwarded_strength = output * (0.85 + (gate_decision.readiness_score * 0.1))
                if forwarded_strength <= 0.02:
                    continue
                self.scheduler.push(
                    {
                        "nodule_id": route.target_id,
                        "strength": forwarded_strength,
                        "depth": depth + 1,
                        "cycle_id": cycle_id + 1,
                    },
                    priority=route.score,
                )
                self._signal_queue.append(
                    Signal(
                        trace_id=trace_id,
                        source_id=nodule_id,
                        target_id=route.target_id,
                        strength=forwarded_strength,
                        depth=depth + 1,
                        cycle_id=cycle_id + 1,
                        metadata={"route_score": route.score, "pathway_id": route.pathway_id},
                    )
                )

            mean_output = (last_mean_output + output) / 2.0 if cycle > 0 else output
            delta = abs(mean_output - last_mean_output)
            audit_log(
                component="orchestrator.resonance_engine",
                event="resonance_cycle",
                payload={
                    "trace_id": trace_id,
                    "cycle_id": cycle_id,
                    "nodule_id": nodule_id,
                    "new_value": output,
                    "depth": depth,
                    "delta": delta,
                    "readiness_score": gate_decision.readiness_score,
                },
                trace_id=trace_id,
            )
            if cycle > 0 and delta < self.convergence_epsilon:
                break
            last_mean_output = mean_output
            cycle += 1

        keep_count = max(1, int(round(5 * gate_decision.hypothesis_keep_ratio)))
        candidates = hypothesis_pool.top(k=keep_count)
        hypothesis_pool.prune(readiness_score=gate_decision.readiness_score, trace_id=trace_id)
        return candidates

    def propagation_trail(self) -> List[Dict[str, object]]:
        return list(self._propagation_trail)
