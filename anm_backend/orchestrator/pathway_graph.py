"""
FILE: orchestrator/pathway_graph.py
RESPONSIBILITY: In-memory directed graph of inter-nodule pathways.
FLOW ROLE: Stores routing attributes used by router/myelination/resonance.
READS: Edge upserts and lookup requests.
RAM WRITES: Pathway adjacency structure.
PERSISTS: Serializable state exported to checkpoint/debug.
PRIMARY RISK: Inconsistent ids if pathway keys are not deterministic.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Dict, Iterable, List, Tuple

from anm_backend.audit import audit_log
from anm_backend.contracts import PathwayId


def build_pathway_id(source_id: str, target_id: str) -> PathwayId:
    return PathwayId(f"{source_id}->{target_id}")


@dataclass
class Pathway:
    """
    Objective:
        Represent one directed pathway between nodules.
    Responsibilities:
        Hold weight/priority/cost/myelin attributes for routing and adaptation.
    Limits:
        Data object only.
    Mutates:
        Weight/priority/cost/myelin through myelination and admin flows.
    Must not:
        Execute propagation logic directly.
    """

    source_id: str
    target_id: str
    weight: float = 0.5
    priority: float = 0.5
    cost: float = 1.0
    myelin: float = 0.5
    pathway_id: str = ""

    def __post_init__(self) -> None:
        if not self.pathway_id:
            self.pathway_id = str(build_pathway_id(self.source_id, self.target_id))


@dataclass
class PathwayGraph:
    """
    Objective:
        Manage directed pathway graph in RAM.
    Responsibilities:
        Upsert edges and provide neighbor/pathway queries.
    Limits:
        No scheduling behavior.
    Mutates:
        Internal edge map.
    Must not:
        Run resonance cycles.
    """

    edges: Dict[Tuple[str, str], Pathway] = field(default_factory=dict)

    def upsert_pathway(self, pathway: Pathway) -> None:
        self.edges[(pathway.source_id, pathway.target_id)] = pathway
        audit_log(
            component="orchestrator.pathway_graph",
            event="pathway_upserted",
            payload={"pathway_id": pathway.pathway_id, "source_id": pathway.source_id, "target_id": pathway.target_id},
        )

    def outgoing(self, source_id: str) -> List[Pathway]:
        return [edge for (src, _), edge in self.edges.items() if src == source_id]

    def neighbors(self, source_id: str) -> List[str]:
        return [edge.target_id for edge in self.outgoing(source_id)]

    def get(self, source_id: str, target_id: str) -> Pathway | None:
        return self.edges.get((source_id, target_id))

    def all_edges(self) -> Iterable[Pathway]:
        return self.edges.values()

    def export_state(self) -> List[Dict[str, float]]:
        return [asdict(edge) for edge in self.edges.values()]
