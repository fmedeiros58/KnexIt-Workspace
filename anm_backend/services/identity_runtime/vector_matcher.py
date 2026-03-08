"""
FILE: services/identity_runtime/vector_matcher.py
RESPONSIBILITY: Compute vector similarity and candidate ranking.
FLOW ROLE: Layer-8 matching policy for embeddings and directed search.
READS: Probe embedding and reference embeddings.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Threshold drift can increase false positives/negatives.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Sequence

try:
    import numpy as np  # type: ignore
except Exception:  # noqa: BLE001
    np = None  # type: ignore[assignment]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _normalize_view(value: str) -> str:
    key = str(value or "").strip().lower()
    if key in {"left", "lateral-left", "left-profile", "channel-2", "environment-left"}:
        return "left"
    if key in {"right", "lateral-right", "right-profile", "channel-4", "environment-right"}:
        return "right"
    if key in {"front", "frontal", "main", "center", "channel-3", "environment-front"}:
        return "front"
    return "unknown"


@dataclass
class VectorMatch:
    candidate_id: str
    similarity: float
    threshold: float
    accepted: bool
    view: str = "unknown"

    def to_dict(self) -> Dict[str, object]:
        return {
            "candidate_id": self.candidate_id,
            "similarity": float(_clamp(self.similarity, 0.0, 1.0)),
            "threshold": float(_clamp(self.threshold, 0.0, 1.0)),
            "accepted": bool(self.accepted),
            "view": self.view,
        }


@dataclass
class VectorMatcher:
    default_threshold: float = 0.72
    view_thresholds: Dict[str, float] = field(default_factory=lambda: {"front": 0.74, "left": 0.76, "right": 0.76})

    def cosine_similarity(self, probe: Sequence[float], reference: Sequence[float]) -> float:
        if np is None:
            return 0.0
        probe_v = np.asarray(list(probe), dtype="float32")
        ref_v = np.asarray(list(reference), dtype="float32")
        if probe_v.size <= 0 or ref_v.size <= 0:
            return 0.0
        size = min(probe_v.size, ref_v.size)
        if size <= 0:
            return 0.0
        probe_v = probe_v[:size]
        ref_v = ref_v[:size]
        norm_probe = float(np.linalg.norm(probe_v))
        norm_ref = float(np.linalg.norm(ref_v))
        if norm_probe <= 0 or norm_ref <= 0:
            return 0.0
        raw_cos = float(np.dot(probe_v, ref_v) / (norm_probe * norm_ref))
        return float(_clamp((raw_cos + 1.0) / 2.0, 0.0, 1.0))

    def threshold_for_view(self, view: str) -> float:
        key = _normalize_view(view)
        return float(_clamp(self.view_thresholds.get(key, self.default_threshold), 0.05, 0.99))

    def rank_candidates(
        self,
        *,
        probe_embedding: Sequence[float],
        candidates: Dict[str, Iterable[Sequence[float]]],
        view: str = "unknown",
        limit: int = 5,
    ) -> List[VectorMatch]:
        threshold = self.threshold_for_view(view)
        rows: List[VectorMatch] = []
        for candidate_id, vectors in (candidates or {}).items():
            best = 0.0
            for vector in vectors:
                score = self.cosine_similarity(probe_embedding, vector)
                if score > best:
                    best = score
            if best <= 0.0:
                continue
            rows.append(
                VectorMatch(
                    candidate_id=str(candidate_id),
                    similarity=float(best),
                    threshold=threshold,
                    accepted=bool(best >= threshold),
                    view=_normalize_view(view),
                )
            )
        rows.sort(key=lambda item: item.similarity, reverse=True)
        return rows[: max(1, int(limit))]

