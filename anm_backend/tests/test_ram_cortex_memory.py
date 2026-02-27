import unittest

from anm_backend.memory.ram_cortex import RamCortex


class RamCortexTests(unittest.TestCase):
    def test_context_activation_hypothesis_mutation(self) -> None:
        cortex = RamCortex()
        cortex.update_context("k1", {"v": 1}, source="test")
        cortex.set_activation("n1", 0.9, cycle_id=1)
        self.assertIn("k1", cortex.active_context)
        self.assertAlmostEqual(cortex.activation_map["n1"], 0.9, places=4)

        snapshot = cortex.snapshot()
        restored = RamCortex()
        restored.restore(snapshot)
        self.assertIn("k1", restored.active_context)
        self.assertIn("n1", restored.activation_map)


if __name__ == "__main__":
    unittest.main()
