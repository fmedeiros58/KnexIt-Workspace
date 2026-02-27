"""
FILE: anm/network.py
RESPONSIBILITY: Topology container for autonomous nodules and their relations.
FLOW ROLE: In-memory nodule catalog consumed by orchestrator.
READS: Registration/link requests.
RAM WRITES: Nodule map and relation map.
PERSISTS: Exportable through debug/checkpoint paths.
PRIMARY RISK: Stale relations if nodules are removed without cleanup.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, Optional, Set

from anm_backend.anm.nodule import Nodule


@dataclass
class Network:
    """
    Objective:
        Maintain nodule catalog and logical adjacency.
    Responsibilities:
        Register nodules, create links and expose topology inspection methods.
    Limits:
        No scheduling/routing logic.
    Mutates:
        Internal nodule and relation maps.
    Must not:
        Execute cognitive cycles directly.
    """

    nodules: Dict[str, Nodule] = field(default_factory=dict)
    relations: Dict[str, Set[str]] = field(default_factory=dict)

    def register_nodule(self, nodule: Nodule) -> None:
        self.nodules[nodule.nodule_id] = nodule
        self.relations.setdefault(nodule.nodule_id, set())

    def get_nodule(self, nodule_id: str) -> Optional[Nodule]:
        return self.nodules.get(nodule_id)

    def iter_nodules(self) -> Iterable[Nodule]:
        return self.nodules.values()

    def connect(self, source_id: str, target_id: str) -> None:
        self.relations.setdefault(source_id, set()).add(target_id)
        self.relations.setdefault(target_id, set())

    def neighbors(self, source_id: str) -> Set[str]:
        return set(self.relations.get(source_id, set()))
