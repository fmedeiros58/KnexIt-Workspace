"""
FILE: utils/__init__.py
RESPONSIBILITY: Shared utility exports for ANM backend.
FLOW ROLE: Keep cross-cutting helpers reusable across services/adapters.
READS: N/A.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Utility drift if duplicated logic is added outside this package.
"""

from anm_backend.utils.language_policy import detect_user_language, describe_language

__all__ = [
    "detect_user_language",
    "describe_language",
]

