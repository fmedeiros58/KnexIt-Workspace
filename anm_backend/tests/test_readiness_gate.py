import unittest

from anm_backend.anm.plasticity_readiness import PlasticityReadiness
from anm_backend.contracts import ReadinessState
from anm_backend.memory.regulatory_state import RegulatoryState
from anm_backend.orchestrator.contextual_plasticity_gate import ContextualPlasticityGate


class ReadinessGateTests(unittest.TestCase):
    def test_readiness_score_and_state(self) -> None:
        readiness = PlasticityReadiness()
        snapshot = readiness.compute(
            {
                "stimulus_quality": 0.9,
                "stimulus_consistency": 0.8,
                "stimulus_coherence": 0.9,
                "affective_safety": 0.8,
                "stress_load": 0.1,
                "context_stability": 0.8,
                "support_density": 0.7,
                "recovery_margin": 0.8,
            }
        )
        self.assertGreater(snapshot.readiness_score, 0.6)
        self.assertIn(snapshot.readiness_state, {ReadinessState.STABLE, ReadinessState.AMPLIFIED})

    def test_contextual_gate_and_block_rule(self) -> None:
        readiness = PlasticityReadiness()
        regulatory = RegulatoryState(stress_load=0.9, context_stability=0.2)
        snapshot = readiness.compute(
            {
                "stimulus_quality": 0.5,
                "stimulus_consistency": 0.5,
                "stimulus_coherence": 0.4,
                "affective_safety": 0.2,
                "stress_load": 0.9,
                "context_stability": 0.2,
                "support_density": 0.4,
                "recovery_margin": 0.3,
            }
        )
        gate = ContextualPlasticityGate().apply(snapshot, regulatory)
        self.assertFalse(gate.allow_structural_consolidation)
        self.assertLessEqual(gate.readiness_score, 0.2)


if __name__ == "__main__":
    unittest.main()
