"""
FILE: memory/working_memory.py
RESPONSIBILITY: High-turnover RAM-only working memory for current cognitive focus.
FLOW ROLE: Holds what ANM is "thinking about now".
READS: New observations and active task prompts.
RAM WRITES: Working item queue and focus index.
PERSISTS: Optional export via checkpoint manager only.
PRIMARY RISK: Latency increase if queue grows without forgetting control.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List

from anm_backend.audit import audit_log


@dataclass
class WorkingItem:
    """
    Objective:
        Represent an active short-horizon cognitive item.
    Responsibilities:
        Store content, salience and temporal metadata.
    Limits:
        Not designed for long-term persistence.
    Mutates:
        salience and hit_count.
    Must not:
        Bypass memory policies.
    """

    item_id: str
    content: Dict[str, Any]
    salience: float = 0.5
    hit_count: int = 0


@dataclass
class WorkingMemory:
    """
    Objective:
        Maintain low-latency RAM state for immediate reasoning.
    Responsibilities:
        Push/pop/update active items and expose current focus window.
    Limits:
        Capacity-limited FIFO with salience updates.
    Mutates:
        Internal deque and item metadata.
    Must not:
        Persist data directly.
    """

    capacity: int = 128
    _items: Deque[WorkingItem] = field(default_factory=deque)

    def push(self, item: WorkingItem) -> None:
        """
        Purpose:
            Insert active item into working set with bounded capacity.
        Parameters:
            item: Working item to insert.
        Returns:
            None.
        Side Effects:
            Removes oldest item when capacity is reached.
        RAM Impact:
            Mutates deque in RAM.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        if len(self._items) >= self.capacity:
            dropped = self._items.popleft()
            # AUDIT: bounded RAM eviction in working memory.
            audit_log(
                component="memory.working_memory",
                event="evict_oldest",
                payload={"item_id": dropped.item_id},
            )
        self._items.append(item)
        # AUDIT: critical working-memory mutation.
        audit_log(
            component="memory.working_memory",
            event="push",
            payload={"item_id": item.item_id, "size": len(self._items)},
        )

    def bump(self, item_id: str, delta: float = 0.1) -> None:
        """
        Purpose:
            Increase salience/hit-count for an existing item.
        Parameters:
            item_id: Target item id.
            delta: Salience increment.
        Returns:
            None.
        Side Effects:
            None.
        RAM Impact:
            Mutates target item in deque.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        for item in self._items:
            if item.item_id != item_id:
                continue
            item.salience = min(1.0, item.salience + delta)
            item.hit_count += 1
            # AUDIT: salience reinforcement in RAM.
            audit_log(
                component="memory.working_memory",
                event="bump",
                payload={"item_id": item_id, "salience": item.salience, "hit_count": item.hit_count},
            )
            return

    def top(self, limit: int = 12) -> List[WorkingItem]:
        """
        Purpose:
            Return most salient working items.
        Parameters:
            limit: Maximum number of items.
        Returns:
            List[WorkingItem]: Ranked working items.
        Side Effects:
            None.
        RAM Impact:
            Temporary sorted list allocation.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return sorted(list(self._items), key=lambda item: (item.salience, item.hit_count), reverse=True)[:limit]

    def remove(self, item_id: str) -> bool:
        """
        Purpose:
            Remove specific item from working set.
        Parameters:
            item_id: Item identifier.
        Returns:
            bool: True when removed, False otherwise.
        Side Effects:
            Emits AUDIT on removal.
        RAM Impact:
            Rebuilds deque without removed item.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        original_size = len(self._items)
        self._items = deque(item for item in self._items if item.item_id != item_id)
        removed = len(self._items) != original_size
        if removed:
            # AUDIT: explicit deletion from working memory.
            audit_log(
                component="memory.working_memory",
                event="remove",
                payload={"item_id": item_id, "size": len(self._items)},
            )
        return removed

    def export_state(self) -> List[Dict[str, Any]]:
        """
        Purpose:
            Export serializable state for checkpointing.
        Parameters:
            None.
        Returns:
            List[Dict[str, Any]]: Serializable working-memory state.
        Side Effects:
            None.
        RAM Impact:
            Creates temporary list copy.
        Persistence Impact:
            Intended checkpoint payload.
        Expected Failures:
            None.
        """

        return [
            {"item_id": item.item_id, "content": item.content, "salience": item.salience, "hit_count": item.hit_count}
            for item in self._items
        ]

    def restore_state(self, payload: List[Dict[str, Any]]) -> None:
        """
        Purpose:
            Restore working-memory state from checkpoint payload.
        Parameters:
            payload: Serialized list of working items.
        Returns:
            None.
        Side Effects:
            Replaces current queue.
        RAM Impact:
            Overwrites working-memory queue.
        Persistence Impact:
            None.
        Expected Failures:
            ValueError/TypeError for malformed payload.
        """

        self._items = deque(WorkingItem(**item) for item in payload[: self.capacity])
        # AUDIT: full working-memory restore.
        audit_log(
            component="memory.working_memory",
            event="restore_state",
            payload={"size": len(self._items)},
        )
