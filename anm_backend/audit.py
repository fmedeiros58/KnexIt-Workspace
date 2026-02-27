"""
FILE: audit.py
RESPONSIBILITY: Structured audit logging utilities for ANM.
FLOW ROLE: Cross-cutting traceability support for all critical mutations.
READS: Call-site event payloads and logging configuration.
RAM WRITES: None.
PERSISTS: Optional stdout/file logs depending on runtime logging handlers.
PRIMARY RISK: Over-logging sensitive payloads if callers do not sanitize fields.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict
from uuid import uuid4

LOGGER_NAME = "anm.audit"


def get_logger() -> logging.Logger:
    """
    Purpose:
        Return the shared structured logger used by ANM components.
    Parameters:
        None.
    Returns:
        logging.Logger: Configured logger instance.
    Side Effects:
        Initializes a default StreamHandler once.
    RAM Impact:
        Allocates logger/handler metadata in process memory.
    Persistence Impact:
        None by itself; persistence depends on external logging handlers.
    Expected Failures:
        None expected in normal runtime.
    """

    logger = logging.getLogger(LOGGER_NAME)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    logger.propagate = False
    return logger


def audit_log(component: str, event: str, payload: Dict[str, Any], trace_id: str | None = None) -> None:
    """
    Purpose:
        Emit a normalized AUDIT log event for critical ANM mutations.
    Parameters:
        component: Logical subsystem name (memory/orchestrator/etc.).
        event: Event identifier.
        payload: Sanitized event details.
        trace_id: Optional correlation id; generated when omitted.
    Returns:
        None.
    Side Effects:
        Writes a structured log line through logger handlers.
    RAM Impact:
        Temporary dict allocation for event envelope.
    Persistence Impact:
        Possible if handlers route logs to files/storage.
    Expected Failures:
        JSON serialization errors for non-serializable payload fields.
    """

    envelope = {
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "trace_id": trace_id or f"trace-{uuid4()}",
        "component": component,
        "event": event,
        "payload": payload,
    }
    get_logger().info(json.dumps(envelope, ensure_ascii=False, default=str))
