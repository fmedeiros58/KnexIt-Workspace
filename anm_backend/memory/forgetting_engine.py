"""
FILE: memory/forgetting_engine.py
RESPONSIBILITY: Functional forgetting and noise pruning.
FLOW ROLE: Keeps RAM cognitively clean and avoids saturation.
READS: Working memory items and policy thresholds.
RAM WRITES: Removes low-value items from active memory.
PERSISTS: Optional forgetting traces in structured logs.
PRIMARY RISK: Over-aggressive pruning may drop useful context.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from anm_backend.audit import audit_log
from anm_backend.memory.memory_policies import MemoryPolicies
from anm_backend.memory.working_memory import WorkingMemory


@dataclass
class ForgettingEngine:
    """
    Objective:
        Remove low-value cognitive residue from RAM.
    Responsibilities:
        Evaluate retention scores and evict stale/low-salience items.
    Limits:
        Operates only on provided memory surfaces.
    Mutates:
        Working memory contents.
    Must not:
        Persist state as primary reasoning store.
    """

    policies: MemoryPolicies

    def run(self, working_memory: WorkingMemory) -> List[str]:
        """
        Purpose:
            Execute one forgetting cycle over working memory.
        Parameters:
            working_memory: Live working-memory instance.
        Returns:
            List[str]: Removed item ids.
        Side Effects:
            Emits AUDIT logs for removals.
        RAM Impact:
            Mutates working-memory queue.
        Persistence Impact:
            None directly.
        Expected Failures:
            None.
        """

        removed: List[str] = []
        # NOTE: two-step scan prevents in-loop structural mutation hazards.
        candidates = working_memory.top(limit=working_memory.capacity)
        for item in candidates:
            score = self.policies.retention_score(
                salience=item.salience,
                recurrence=min(1.0, item.hit_count / 8.0),
                objective_fit=0.4,
            )
            if not self.policies.should_forget(score):
                continue
            if working_memory.remove(item.item_id):
                removed.append(item.item_id)
                # AUDIT: explicit forget mutation.
                audit_log(
                    component="memory.forgetting_engine",
                    event="item_forgotten",
                    payload={"item_id": item.item_id, "score": score},
                )
        return removed
