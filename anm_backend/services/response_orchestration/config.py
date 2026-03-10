"""
FILE: services/response_orchestration/config.py
RESPONSIBILITY: Feature flags and limits for secondary process memory orchestration.
FLOW ROLE: Centralize environment-driven behavior toggles and hard limits.
READS: Process environment.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Invalid env values causing unintended strategy selection.
"""

from __future__ import annotations

import os

from typing import Literal

EmissionMode = Literal["chat", "write"]


def env_bool(name: str, *, default: bool = False) -> bool:
    raw = str(os.getenv(name, "1" if default else "0")).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def env_int(name: str, *, default: int, low: int, high: int) -> int:
    raw = str(os.getenv(name, str(default))).strip()
    try:
        parsed = int(raw)
    except ValueError:
        parsed = default
    return max(low, min(high, parsed))


def env_float(name: str, *, default: float, low: float, high: float) -> float:
    raw = str(os.getenv(name, str(default))).strip()
    try:
        parsed = float(raw)
    except ValueError:
        parsed = default
    return max(low, min(high, parsed))


def is_secondary_process_memory_enabled(mode: EmissionMode) -> bool:
    global_enabled = env_bool("SECONDARY_PROCESS_MEMORY_ENABLED", default=True)
    if not global_enabled:
        return False
    if mode == "chat":
        return env_bool("CHAT_SECONDARY_PROCESS_MEMORY_ENABLED", default=global_enabled)
    return env_bool("WRITE_SECONDARY_PROCESS_MEMORY_ENABLED", default=global_enabled)


def is_cross_call_secondary_memory_enabled(mode: EmissionMode) -> bool:
    global_enabled = env_bool("SECONDARY_PROCESS_MEMORY_CROSS_CALL_ENABLED", default=True)
    if not global_enabled:
        return False
    if mode == "chat":
        return env_bool("CHAT_SECONDARY_PROCESS_MEMORY_CROSS_CALL_ENABLED", default=global_enabled)
    return env_bool("WRITE_SECONDARY_PROCESS_MEMORY_CROSS_CALL_ENABLED", default=global_enabled)


def resolve_mode_max_cycles(mode: EmissionMode) -> int:
    global_default = env_int("RESPONSE_ORCHESTRATION_MAX_CYCLES", default=10, low=1, high=10)
    if mode == "chat":
        return env_int("CHAT_MAX_RESPONSE_CYCLES", default=global_default, low=1, high=10)
    return env_int("WRITE_MAX_RESPONSE_CYCLES", default=global_default, low=1, high=10)


def deep_mode_enabled() -> bool:
    return env_bool("RESPONSE_ORCHESTRATION_DEEP_MODE_ENABLED", default=True)


def resolve_target_chunk_tokens() -> int:
    return env_int("TARGET_CHUNK_TOKENS", default=320, low=80, high=4096)


def resolve_max_total_response_tokens() -> int:
    return env_int("MAX_TOTAL_RESPONSE_TOKENS", default=4096, low=256, high=32768)


def resolve_continuity_summary_max_tokens() -> int:
    return env_int("CONTINUITY_SUMMARY_MAX_TOKENS", default=180, low=40, high=1200)


def resolve_redundancy_threshold() -> float:
    return env_float("REDUNDANCY_THRESHOLD", default=0.86, low=0.60, high=0.99)


def contradiction_check_enabled() -> bool:
    return env_bool("CONTRADICTION_CHECK_ENABLED", default=False)


def force_final_synthesis() -> bool:
    return env_bool("FORCE_FINAL_SYNTHESIS", default=False)


def resolve_secondary_memory_ttl_seconds() -> int:
    return env_int("SECONDARY_PROCESS_MEMORY_TTL_SECONDS", default=900, low=30, high=86_400)


def resolve_secondary_memory_max_sessions() -> int:
    return env_int("SECONDARY_PROCESS_MEMORY_MAX_SESSIONS", default=512, low=16, high=20_000)


def is_phase0_segmented_emission_enabled(mode: EmissionMode) -> bool:
    global_enabled = env_bool("PHASE0_SEGMENTED_EMISSION_ENABLED", default=True)
    if not global_enabled:
        return False
    if mode == "chat":
        return env_bool("PHASE0_CHAT_SEGMENTED_EMISSION_ENABLED", default=global_enabled)
    return env_bool("PHASE0_WRITE_SEGMENTED_EMISSION_ENABLED", default=global_enabled)


def phase0_auto_segmentation_enabled() -> bool:
    return env_bool("PHASE0_SEGMENTED_EMISSION_AUTO_ENABLED", default=False)


def phase0_pre_expansion_strict_enabled() -> bool:
    return env_bool("PHASE0_PRE_EXPANSION_STRICT_ENABLED", default=True)


def resolve_phase0_density_short_threshold() -> float:
    return env_float("PHASE0_DENSITY_SHORT_THRESHOLD", default=1.15, low=0.10, high=6.00)


def resolve_phase0_density_medium_threshold() -> float:
    return env_float("PHASE0_DENSITY_MEDIUM_THRESHOLD", default=2.60, low=0.20, high=12.00)


def resolve_phase0_max_calls() -> int:
    return env_int("PHASE0_MAX_CALLS", default=3, low=1, high=3)


def resolve_phase0_first_chunk_min_tokens() -> int:
    return env_int("PHASE0_FIRST_CHUNK_MIN_TOKENS", default=120, low=64, high=260)


def resolve_phase0_first_chunk_target_tokens() -> int:
    return env_int("PHASE0_FIRST_CHUNK_TARGET_TOKENS", default=150, low=80, high=260)


def resolve_phase0_first_chunk_max_tokens() -> int:
    return env_int("PHASE0_FIRST_CHUNK_MAX_TOKENS", default=180, low=96, high=250)


def resolve_phase0_per_call_max_tokens() -> int:
    return env_int("PHASE0_PER_CALL_MAX_TOKENS", default=180, low=96, high=250)
