import unittest

from anm_backend.orchestrator.collapse_engine import CollapseEngine
from anm_backend.orchestrator.hypothesis_pool import Hypothesis, HypothesisPool


class HypothesisTests(unittest.TestCase):
    def test_create_prune_and_collapse(self) -> None:
        pool = HypothesisPool(max_size=3)
        pool.upsert(
            Hypothesis("h1", "alpha", 0.8, 0.7, 0.2, 0.8, "n1", stimulus_coherence=0.8),
            readiness_score=0.9,
            stimulus_coherence=0.8,
        )
        pool.upsert(
            Hypothesis("h2", "beta", 0.4, 0.5, 0.9, 0.3, "n2", stimulus_coherence=0.2),
            readiness_score=0.2,
            stimulus_coherence=0.2,
        )
        self.assertGreaterEqual(len(pool.active()), 1)
        engine = CollapseEngine(mode="best")
        winner = engine.collapse(pool.top(k=1))
        self.assertEqual(winner.hypothesis_id, "h1")


if __name__ == "__main__":
    unittest.main()
