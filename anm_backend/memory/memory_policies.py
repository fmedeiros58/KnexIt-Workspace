"""
FILE: memory/memory_policies.py
RESPONSIBILITY: Central policy rules for retention, promotion, reinforcement and forgetting.
FLOW ROLE: Decision policy consulted by MemoryManager and ForgettingEngine.
READS: Salience, age, recurrence and objective-fit metadata.
RAM WRITES: None directly; returns policy decisions.
PERSISTS: Optional policy configuration snapshots.
PRIMARY RISK: Misconfigured thresholds can cause memory loss or RAM saturation.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class MemoryPolicies:
    """
    Objective:
        Provide deterministic policy gates for ANM memory lifecycle.
    Responsibilities:
        Decide promotion, retention and forgetting thresholds.
    Limits:
        Does not execute mutation; only returns policy outcomes.
    Mutates:
        Internal threshold values when reconfigured.
    Must not:
        Perform direct RAM eviction.
    """

    promote_threshold: float = 0.72
    forget_threshold: float = 0.25
    decay_factor: float = 0.96

    def retention_score(self, *, salience: float, recurrence: float, objective_fit: float) -> float:
        """
        Purpose:
            Compute retention score used by promotion/forgetting rules.
        Parameters:
            salience: Importance signal [0..1].
            recurrence: Repetition signal [0..1].
            objective_fit: Goal adherence signal [0..1].
        Returns:
            float: Aggregate retention score.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return (0.45 * salience) + (0.30 * recurrence) + (0.25 * objective_fit)

    def should_promote(self, score: float) -> bool:
        """
        Purpose:
            Decide whether memory item should be promoted across levels.
        Parameters:
            score: Retention score.
        Returns:
            bool: Promotion decision.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return score >= self.promote_threshold

    def should_forget(self, score: float) -> bool:
        """
        Purpose:
            Decide whether memory item should be removed/decayed aggressively.
        Parameters:
            score: Retention score.
        Returns:
            bool: Forgetting decision.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return score <= self.forget_threshold

    def decay(self, value: float) -> float:
        """
        Purpose:
            Apply policy-defined decay to a scalar memory attribute.
        Parameters:
            value: Current value.
        Returns:
            float: Decayed value.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return max(0.0, value * self.decay_factor)
