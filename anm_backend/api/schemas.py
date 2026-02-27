"""
FILE: api/schemas.py
RESPONSIBILITY: HTTP request/response schemas for ANM API.
FLOW ROLE: Validate payloads and document explicit route contracts.
READS: Incoming HTTP JSON bodies.
RAM WRITES: Validated model instances only.
PERSISTS: None.
PRIMARY RISK: Schema drift with service payloads if not versioned.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class HypothesisSummary(BaseModel):
    id: str
    score: float
    origin_nodule: str
    stimulus_coherence: float


class ReadinessSummary(BaseModel):
    score: float
    state: str
    dominant_factors: List[str]


class RegulatorySummary(BaseModel):
    stress_load: float
    context_stability: float


class ChatResponse(BaseModel):
    trace_id: str
    answer: str
    collapsed_hypothesis: HypothesisSummary
    readiness: ReadinessSummary
    regulatory_state: RegulatorySummary
    engine: Dict[str, Any]


class CheckpointRequest(BaseModel):
    checkpoint_id: str = Field(min_length=1, max_length=128)


class CheckpointResponse(BaseModel):
    ok: bool
    checkpoint_id: str
    path: Optional[str] = None


class RestoreResponse(BaseModel):
    ok: bool
    checkpoint_id: str
