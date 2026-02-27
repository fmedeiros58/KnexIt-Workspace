import unittest

from anm_backend.orchestrator.myelination_engine import MyelinationEngine
from anm_backend.orchestrator.pathway_graph import Pathway, PathwayGraph


class MyelinationTests(unittest.TestCase):
    def test_reinforce_and_weaken(self) -> None:
        graph = PathwayGraph()
        graph.upsert_pathway(Pathway(source_id="a", target_id="b", weight=0.5, priority=0.5, cost=1.0, myelin=0.5))
        engine = MyelinationEngine()

        engine.reinforce(graph, "a", "b", reward=1.0)
        reinforced = graph.get("a", "b")
        assert reinforced is not None
        self.assertGreater(reinforced.weight, 0.5)

        engine.weaken(graph, "a", "b", penalty=1.0)
        weakened = graph.get("a", "b")
        assert weakened is not None
        self.assertLessEqual(weakened.weight, reinforced.weight)


if __name__ == "__main__":
    unittest.main()
