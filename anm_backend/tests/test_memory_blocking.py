import unittest

from anm_backend.memory.forgetting_engine import ForgettingEngine
from anm_backend.memory.global_memory import GlobalMemory
from anm_backend.memory.memory_manager import MemoryManager
from anm_backend.memory.memory_policies import MemoryPolicies
from anm_backend.memory.module_memory import ModuleMemory
from anm_backend.memory.nodule_memory import NoduleMemory
from anm_backend.memory.ram_cortex import RamCortex
from anm_backend.memory.regulatory_state import RegulatoryState
from anm_backend.memory.working_memory import WorkingMemory
from anm_backend.orchestrator.contextual_plasticity_gate import ContextualGateDecision
from anm_backend.contracts import ReadinessState


class MemoryBlockingTests(unittest.TestCase):
    def test_block_consolidation_under_high_stress_low_stability(self) -> None:
        policies = MemoryPolicies(promote_threshold=0.1)
        regulatory = RegulatoryState(stress_load=0.9, context_stability=0.2)
        manager = MemoryManager(
            cortex=RamCortex(),
            working_memory=WorkingMemory(capacity=10),
            global_memory=GlobalMemory(),
            module_memory=ModuleMemory(),
            nodule_memory=NoduleMemory(),
            policies=policies,
            forgetting_engine=ForgettingEngine(policies=policies),
            regulatory_state=regulatory,
        )
        item_id = manager.ingest_observation(
            module_id="chat",
            nodule_id="language_nodule",
            content={"text": "x"},
            salience=0.9,
            objective_fit=0.9,
            stimulus_quality=0.7,
        )
        gate = ContextualGateDecision(
            readiness_score=0.1,
            readiness_state=ReadinessState.BLOCKED,
            effective_learning_rate=0.001,
            effective_pruning_rate=0.09,
            effective_consolidation_rate=0.0,
            resonance_depth_limit=1,
            hypothesis_keep_ratio=0.2,
            allow_structural_consolidation=False,
            reason="test",
        )
        manager.reinforce_item(item_id, module_id="chat", score_delta=0.9, gate_decision=gate)
        semantic = manager.global_memory.export_state().get("semantic", {})
        self.assertNotIn(item_id, semantic)


if __name__ == "__main__":
    unittest.main()
