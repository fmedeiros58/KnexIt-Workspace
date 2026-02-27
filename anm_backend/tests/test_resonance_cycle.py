import unittest

from anm_backend.anm.neuron import Neuron
from anm_backend.anm.nodule import Nodule
from anm_backend.anm.synapse import Synapse
from anm_backend.memory.ram_cortex import RamCortex
from anm_backend.orchestrator.contextual_plasticity_gate import ContextualGateDecision
from anm_backend.orchestrator.hypothesis_pool import HypothesisPool
from anm_backend.orchestrator.nodule_registry import NoduleRegistry
from anm_backend.orchestrator.pathway_graph import Pathway, PathwayGraph
from anm_backend.orchestrator.resonance_engine import ResonanceEngine
from anm_backend.orchestrator.router import Router
from anm_backend.orchestrator.scheduler import Scheduler
from anm_backend.contracts import ReadinessState


class ResonanceTests(unittest.TestCase):
    def test_simple_resonance_cycle(self) -> None:
        nodule = Nodule(
            nodule_id="n1",
            neurons={"n1-in": Neuron("n1-in"), "n1-out": Neuron("n1-out")},
            synapses=[Synapse("n1-in", "n1-out", weight=0.9)],
        )
        registry = NoduleRegistry()
        registry.register(nodule, capabilities={"chat": 1.0})
        graph = PathwayGraph()
        graph.upsert_pathway(Pathway(source_id="n1", target_id="n1", weight=0.5, priority=0.5, cost=1.0, myelin=0.5))
        engine = ResonanceEngine(
            registry=registry,
            graph=graph,
            router=Router(max_fan_out=1),
            scheduler=Scheduler(max_cycles=2),
            max_depth=1,
        )
        gate = ContextualGateDecision(
            readiness_score=0.7,
            readiness_state=ReadinessState.STABLE,
            effective_learning_rate=0.03,
            effective_pruning_rate=0.02,
            effective_consolidation_rate=0.07,
            resonance_depth_limit=1,
            hypothesis_keep_ratio=0.8,
            allow_structural_consolidation=True,
            reason="test",
            dominant_factors=["stimulus_quality"],
        )
        hypotheses = engine.run(
            seed_nodule_id="n1",
            seed_strength=0.8,
            cortex=RamCortex(),
            hypothesis_pool=HypothesisPool(),
            gate_decision=gate,
            trace_id="trace-test",
            stimulus_metrics={
                "stimulus_quality": 0.7,
                "stimulus_consistency": 0.6,
                "stimulus_coherence": 0.7,
                "affective_safety": 0.8,
                "stress_load": 0.2,
                "context_stability": 0.7,
                "support_density": 0.6,
                "recovery_margin": 0.7,
            },
        )
        self.assertGreaterEqual(len(hypotheses), 1)


if __name__ == "__main__":
    unittest.main()
