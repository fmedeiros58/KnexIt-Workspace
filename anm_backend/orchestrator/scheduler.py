"""
FILE: orchestrator/scheduler.py
RESPONSIBILITY: Priority scheduler for in-process cognitive cycles.
FLOW ROLE: Bound task ordering for resonance and internal orchestration work.
READS: Priority/task inserts and cycle budget config.
RAM WRITES: In-memory priority queue.
PERSISTS: None.
PRIMARY RISK: Starvation risk if priority policy is pathological.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from heapq import heappop, heappush
from typing import List, Tuple


@dataclass
class Scheduler:
    """
    Objective:
        Queue bounded cognitive tasks in priority order.
    Responsibilities:
        Push/pop tasks and enforce max-cycles budget.
    Limits:
        No routing logic.
    Mutates:
        Priority queue.
    Must not:
        Execute nodule/engine logic directly.
    """

    max_cycles: int = 6
    _queue: List[Tuple[float, int, dict]] = field(default_factory=list)
    _counter: int = 0

    def push(self, task: dict, priority: float) -> None:
        self._counter += 1
        heappush(self._queue, (-priority, self._counter, task))

    def pop(self) -> dict | None:
        if not self._queue:
            return None
        _, _, task = heappop(self._queue)
        return task

    def size(self) -> int:
        return len(self._queue)

    def clear(self) -> None:
        self._queue.clear()
        self._counter = 0
