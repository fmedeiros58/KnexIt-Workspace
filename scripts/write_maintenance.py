#!/usr/bin/env python3
"""
FILE: scripts/write_maintenance.py
RESPONSIBILITY: Lightweight operational maintenance commands for /write workspace domain.
FLOW ROLE: Reindex pending chunks, re-summarize stale summaries, consolidate process memory and run consistency checks.
READS: /write API endpoints and optional local state snapshot for reindex selection.
RAM WRITES: In-process reports only.
PERSISTS: Optional reindex state file (JSON) for predictable pending chunk selection.
PRIMARY RISK: Endpoint contract drift may require script updates.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib import error, parse, request

DEFAULT_WRITE_API_BASE_URL = os.getenv("WRITE_API_BASE_URL", "http://127.0.0.1:8010")
DEFAULT_TIMEOUT_SEC = float(os.getenv("WRITE_MAINTENANCE_TIMEOUT_SEC", "20"))
DEFAULT_REINDEX_STATE_FILE = os.getenv("WRITE_MAINTENANCE_REINDEX_STATE", "data/write-maintenance/reindex-state.json")


def utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat()


def log(event: str, payload: Dict[str, Any]) -> None:
    envelope = {
        "timestamp": utc_now_iso(),
        "component": "write_maintenance",
        "event": event,
        "payload": payload,
    }
    print(json.dumps(envelope, ensure_ascii=True), flush=True)


class WriteMaintenanceError(RuntimeError):
    pass


@dataclass
class ApiResult:
    status: int
    payload: Optional[Dict[str, Any]]


class WriteMaintenanceClient:
    def __init__(self, *, base_url: str, timeout_sec: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_sec = max(1.0, float(timeout_sec))

    def request_json(
        self,
        *,
        method: str,
        path: str,
        query: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
        allow_status: Sequence[int] = (200,),
    ) -> ApiResult:
        query_string = ""
        if query:
            normalized = {k: str(v) for k, v in query.items() if v is not None}
            if normalized:
                query_string = f"?{parse.urlencode(normalized)}"
        url = f"{self.base_url}{path}{query_string}"

        body_bytes: Optional[bytes] = None
        headers = {"Accept": "application/json"}
        if payload is not None:
            body_bytes = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = request.Request(url=url, method=method.upper(), headers=headers, data=body_bytes)
        try:
            with request.urlopen(req, timeout=self.timeout_sec) as response:
                status = int(response.status)
                raw = response.read().decode("utf-8", errors="replace").strip()
                parsed_payload = json.loads(raw) if raw else None
        except error.HTTPError as http_error:
            status = int(http_error.code)
            raw = http_error.read().decode("utf-8", errors="replace").strip()
            try:
                parsed_payload = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                parsed_payload = {"detail": raw}
        except error.URLError as url_error:
            raise WriteMaintenanceError(f"request_failed: {method} {url} ({url_error})") from url_error

        if status not in allow_status:
            raise WriteMaintenanceError(
                f"unexpected_status: {method} {path} => {status} payload={json.dumps(parsed_payload, ensure_ascii=True)}"
            )
        return ApiResult(status=status, payload=parsed_payload if isinstance(parsed_payload, dict) else None)

    def list_projects(self, *, limit: int) -> List[Dict[str, Any]]:
        result = self.request_json(method="GET", path="/write/projects", query={"limit": max(1, int(limit))}, allow_status=(200,))
        projects = result.payload.get("projects") if result.payload else None
        if not isinstance(projects, list):
            raise WriteMaintenanceError("invalid_response: /write/projects missing list")
        return [item for item in projects if isinstance(item, dict)]

    def get_project_sections(self, *, project_id: str, include_chunks: bool, include_summaries: bool) -> List[Dict[str, Any]]:
        result = self.request_json(
            method="GET",
            path=f"/write/projects/{project_id}/sections",
            query={
                "include_chunks": str(bool(include_chunks)).lower(),
                "include_summaries": str(bool(include_summaries)).lower(),
            },
            allow_status=(200,),
        )
        sections = result.payload.get("sections") if result.payload else None
        if not isinstance(sections, list):
            raise WriteMaintenanceError(f"invalid_response: sections missing for project={project_id}")
        return [item for item in sections if isinstance(item, dict)]


def load_reindex_state(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {"chunks": {}, "last_run_at": None}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"chunks": {}, "last_run_at": None}
    chunks = payload.get("chunks") if isinstance(payload, dict) else None
    if not isinstance(chunks, dict):
        chunks = {}
    return {
        "chunks": chunks,
        "last_run_at": payload.get("last_run_at") if isinstance(payload, dict) else None,
    }


def save_reindex_state(path: Path, state: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def normalize_project_ids(projects: List[Dict[str, Any]], requested_ids: Sequence[str]) -> List[str]:
    available = [str(item.get("project_id", "")).strip() for item in projects]
    available = [item for item in available if item]
    if not requested_ids:
        return available
    requested = [item.strip() for item in requested_ids if item.strip()]
    allowed = set(available)
    selected = [item for item in requested if item in allowed]
    missing = [item for item in requested if item not in allowed]
    if missing:
        log("project_filter_missing", {"missing_project_ids": missing})
    return selected


def run_reindex(args: argparse.Namespace) -> int:
    client = WriteMaintenanceClient(base_url=args.base_url, timeout_sec=args.timeout_sec)
    state_path = Path(args.state_file)
    state = load_reindex_state(state_path)
    previous_chunks = state.get("chunks") if isinstance(state, dict) else {}
    if not isinstance(previous_chunks, dict):
        previous_chunks = {}

    projects = client.list_projects(limit=args.max_projects)
    project_ids = normalize_project_ids(projects, args.project_id)

    candidates: List[Dict[str, Any]] = []
    for project_id in project_ids:
        sections = client.get_project_sections(project_id=project_id, include_chunks=True, include_summaries=False)
        for section in sections:
            section_id = str(section.get("section_id", "")).strip()
            chunks = section.get("chunks")
            if not section_id or not isinstance(chunks, list):
                continue
            for chunk in chunks:
                if not isinstance(chunk, dict):
                    continue
                chunk_id = str(chunk.get("chunk_id", "")).strip()
                if not chunk_id:
                    continue
                candidates.append(
                    {
                        "project_id": project_id,
                        "section_id": section_id,
                        "chunk_id": chunk_id,
                        "version": int(chunk.get("version", 1) or 1),
                        "updated_at": str(chunk.get("updated_at", "")),
                    }
                )

    candidates.sort(key=lambda row: row.get("updated_at", ""), reverse=True)
    if args.max_chunks > 0:
        candidates = candidates[: args.max_chunks]

    pending: List[Dict[str, Any]] = []
    for chunk in candidates:
        snapshot = previous_chunks.get(chunk["chunk_id"]) if isinstance(previous_chunks, dict) else None
        if not isinstance(snapshot, dict):
            pending.append(chunk)
            continue
        if int(snapshot.get("version", 0)) != int(chunk["version"]):
            pending.append(chunk)
            continue
        if str(snapshot.get("updated_at", "")) != str(chunk["updated_at"]):
            pending.append(chunk)
            continue

    processed = 0
    failures: List[Dict[str, Any]] = []
    for chunk in pending:
        chunk_id = chunk["chunk_id"]
        try:
            result = client.request_json(method="POST", path=f"/write/chunks/{chunk_id}/reindex", allow_status=(200,))
            payload = result.payload or {}
            previous_chunks[chunk_id] = {
                "version": chunk["version"],
                "updated_at": chunk["updated_at"],
                "last_reindex_at": str(payload.get("reindexed_at") or utc_now_iso()),
            }
            processed += 1
        except Exception as exc:  # noqa: BLE001
            failures.append({"chunk_id": chunk_id, "error": str(exc)})

    state["chunks"] = previous_chunks
    state["last_run_at"] = utc_now_iso()
    save_reindex_state(state_path, state)

    summary = {
        "mode": "reindex",
        "projects_considered": len(project_ids),
        "chunks_scanned": len(candidates),
        "chunks_pending": len(pending),
        "chunks_reindexed": processed,
        "chunks_failed": len(failures),
        "state_file": str(state_path),
        "failures": failures,
    }
    log("maintenance_reindex_completed", summary)
    return 2 if failures else 0


def run_resummarize(args: argparse.Namespace) -> int:
    client = WriteMaintenanceClient(base_url=args.base_url, timeout_sec=args.timeout_sec)
    projects = client.list_projects(limit=args.max_projects)
    project_ids = normalize_project_ids(projects, args.project_id)

    checked_sections = 0
    resummarized_sections = 0
    checked_projects = 0
    resummarized_projects = 0
    failures: List[Dict[str, Any]] = []

    for project_id in project_ids:
        sections = client.get_project_sections(project_id=project_id, include_chunks=False, include_summaries=False)
        for section in sections[: max(1, args.max_sections_per_project)]:
            section_id = str(section.get("section_id", "")).strip()
            if not section_id:
                continue
            checked_sections += 1
            try:
                section_summary = client.request_json(
                    method="GET",
                    path=f"/write/sections/{section_id}/summary",
                    allow_status=(200, 404),
                )
                section_is_stale = False
                if section_summary.status == 404:
                    section_is_stale = True
                else:
                    section_payload = section_summary.payload or {}
                    summary_payload = section_payload.get("summary") if isinstance(section_payload, dict) else None
                    section_is_stale = bool(summary_payload.get("is_stale")) if isinstance(summary_payload, dict) else True

                if section_is_stale:
                    client.request_json(method="POST", path=f"/write/sections/{section_id}/summarize", allow_status=(200,))
                    resummarized_sections += 1
            except Exception as exc:  # noqa: BLE001
                failures.append({"scope": "section", "section_id": section_id, "error": str(exc)})

        checked_projects += 1
        try:
            project_summary = client.request_json(
                method="GET",
                path=f"/write/projects/{project_id}/summary",
                allow_status=(200, 404),
            )
            project_is_stale = False
            if project_summary.status == 404:
                project_is_stale = True
            else:
                project_payload = project_summary.payload or {}
                summary_payload = project_payload.get("summary") if isinstance(project_payload, dict) else None
                project_is_stale = bool(summary_payload.get("is_stale")) if isinstance(summary_payload, dict) else True

            if project_is_stale:
                client.request_json(method="POST", path=f"/write/projects/{project_id}/summarize", allow_status=(200,))
                resummarized_projects += 1
        except Exception as exc:  # noqa: BLE001
            failures.append({"scope": "project", "project_id": project_id, "error": str(exc)})

    summary = {
        "mode": "resummarize",
        "projects_checked": checked_projects,
        "projects_resummarized": resummarized_projects,
        "sections_checked": checked_sections,
        "sections_resummarized": resummarized_sections,
        "failures": failures,
    }
    log("maintenance_resummarize_completed", summary)
    return 2 if failures else 0


def run_memory_consolidation(args: argparse.Namespace) -> int:
    client = WriteMaintenanceClient(base_url=args.base_url, timeout_sec=args.timeout_sec)
    projects = client.list_projects(limit=args.max_projects)
    project_ids = normalize_project_ids(projects, args.project_id)

    processed = 0
    failures: List[Dict[str, Any]] = []
    results: List[Dict[str, Any]] = []

    payload = {
        "similarity_threshold": float(args.similarity_threshold),
        "ttl_days": int(args.ttl_days),
        "low_priority_max": int(args.low_priority_max),
        "dry_run": bool(args.dry_run),
    }

    for project_id in project_ids:
        try:
            response = client.request_json(
                method="POST",
                path=f"/write/projects/{project_id}/memory/consolidate",
                payload=payload,
                allow_status=(200,),
            )
            processed += 1
            response_payload = response.payload or {}
            results.append(
                {
                    "project_id": project_id,
                    "active_count": response_payload.get("active_count"),
                    "inactive_count": response_payload.get("inactive_count"),
                    "deactivated_memory_ids": response_payload.get("deactivated_memory_ids", []),
                    "deactivated_by_ttl_ids": response_payload.get("deactivated_by_ttl_ids", []),
                }
            )
        except Exception as exc:  # noqa: BLE001
            failures.append({"project_id": project_id, "error": str(exc)})

    summary = {
        "mode": "memory",
        "projects_considered": len(project_ids),
        "projects_processed": processed,
        "dry_run": bool(args.dry_run),
        "similarity_threshold": float(args.similarity_threshold),
        "ttl_days": int(args.ttl_days),
        "low_priority_max": int(args.low_priority_max),
        "results": results,
        "failures": failures,
    }
    log("maintenance_memory_completed", summary)
    return 2 if failures else 0


def run_consistency_check(args: argparse.Namespace) -> int:
    client = WriteMaintenanceClient(base_url=args.base_url, timeout_sec=args.timeout_sec)
    projects = client.list_projects(limit=args.max_projects)
    project_ids = normalize_project_ids(projects, args.project_id)

    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []
    checked_sections = 0
    checked_chunks = 0

    for project_id in project_ids:
        try:
            project_response = client.request_json(method="GET", path=f"/write/projects/{project_id}", allow_status=(200,))
            project_payload = project_response.payload or {}
            project_data = project_payload.get("project") if isinstance(project_payload, dict) else None
            if isinstance(project_data, dict) and str(project_data.get("project_id", "")).strip() != project_id:
                errors.append({"scope": "project", "project_id": project_id, "issue": "project_id_mismatch"})

            sections = client.get_project_sections(project_id=project_id, include_chunks=True, include_summaries=True)
            memory_response = client.request_json(method="GET", path=f"/write/projects/{project_id}/memory", allow_status=(200,))
            memory_payload = memory_response.payload or {}
            process_memory = memory_payload.get("process_memory") if isinstance(memory_payload, dict) else None
            memory_items = process_memory.get("items") if isinstance(process_memory, dict) else []

            seen_chunk_ids: set[str] = set()
            for section in sections:
                section_id = str(section.get("section_id", "")).strip()
                if not section_id:
                    errors.append({"scope": "section", "project_id": project_id, "issue": "missing_section_id"})
                    continue
                checked_sections += 1
                if str(section.get("project_id", "")).strip() != project_id:
                    errors.append({
                        "scope": "section",
                        "project_id": project_id,
                        "section_id": section_id,
                        "issue": "section_project_id_mismatch",
                    })

                section_summary = client.request_json(
                    method="GET",
                    path=f"/write/sections/{section_id}/summary",
                    allow_status=(200, 404),
                )
                if section_summary.status == 404:
                    warnings.append({
                        "scope": "section",
                        "project_id": project_id,
                        "section_id": section_id,
                        "issue": "missing_section_summary",
                    })
                else:
                    summary_payload = (section_summary.payload or {}).get("summary")
                    if isinstance(summary_payload, dict) and bool(summary_payload.get("is_stale")):
                        warnings.append({
                            "scope": "section",
                            "project_id": project_id,
                            "section_id": section_id,
                            "issue": "section_summary_stale",
                            "stale_reasons": summary_payload.get("stale_reasons", []),
                        })

                chunks = section.get("chunks")
                if not isinstance(chunks, list):
                    continue
                for chunk in chunks:
                    if not isinstance(chunk, dict):
                        continue
                    checked_chunks += 1
                    chunk_id = str(chunk.get("chunk_id", "")).strip()
                    chunk_project_id = str(chunk.get("project_id", "")).strip()
                    chunk_section_id = str(chunk.get("section_id", "")).strip()
                    chunk_version = int(chunk.get("version", 0) or 0)
                    if not chunk_id:
                        errors.append({"scope": "chunk", "project_id": project_id, "section_id": section_id, "issue": "missing_chunk_id"})
                        continue
                    if chunk_id in seen_chunk_ids:
                        errors.append({"scope": "chunk", "chunk_id": chunk_id, "project_id": project_id, "issue": "duplicate_chunk_id"})
                    seen_chunk_ids.add(chunk_id)
                    if chunk_project_id != project_id:
                        errors.append({
                            "scope": "chunk",
                            "chunk_id": chunk_id,
                            "project_id": project_id,
                            "issue": "chunk_project_id_mismatch",
                        })
                    if chunk_section_id != section_id:
                        errors.append({
                            "scope": "chunk",
                            "chunk_id": chunk_id,
                            "project_id": project_id,
                            "section_id": section_id,
                            "issue": "chunk_section_id_mismatch",
                        })
                    if chunk_version < 1:
                        errors.append({"scope": "chunk", "chunk_id": chunk_id, "issue": "invalid_chunk_version"})

            project_summary = client.request_json(
                method="GET",
                path=f"/write/projects/{project_id}/summary",
                allow_status=(200, 404),
            )
            if project_summary.status == 404:
                warnings.append({"scope": "project", "project_id": project_id, "issue": "missing_project_summary"})
            else:
                summary_payload = (project_summary.payload or {}).get("summary")
                if isinstance(summary_payload, dict) and bool(summary_payload.get("is_stale")):
                    warnings.append(
                        {
                            "scope": "project",
                            "project_id": project_id,
                            "issue": "project_summary_stale",
                            "stale_reasons": summary_payload.get("stale_reasons", []),
                        }
                    )

            if isinstance(memory_items, list):
                for item in memory_items:
                    if not isinstance(item, dict):
                        continue
                    memory_id = str(item.get("memory_id", "")).strip() or "unknown"
                    item_project_id = str(item.get("project_id", "")).strip()
                    if item_project_id and item_project_id != project_id:
                        errors.append(
                            {
                                "scope": "memory",
                                "project_id": project_id,
                                "memory_id": memory_id,
                                "issue": "memory_project_id_mismatch",
                            }
                        )
                    if not bool(item.get("is_active", True)) and not str(item.get("deactivation_reason", "")).strip():
                        warnings.append(
                            {
                                "scope": "memory",
                                "project_id": project_id,
                                "memory_id": memory_id,
                                "issue": "inactive_without_reason",
                            }
                        )

        except Exception as exc:  # noqa: BLE001
            errors.append({"scope": "project", "project_id": project_id, "issue": "request_failure", "error": str(exc)})

    summary = {
        "mode": "consistency",
        "projects_checked": len(project_ids),
        "sections_checked": checked_sections,
        "chunks_checked": checked_chunks,
        "errors": errors,
        "warnings": warnings,
    }
    log("maintenance_consistency_completed", summary)
    return 2 if errors else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Operational maintenance routines for /write workspace domain.")
    parser.add_argument("--base-url", default=DEFAULT_WRITE_API_BASE_URL, help="Base URL for write API (default: %(default)s)")
    parser.add_argument("--timeout-sec", type=float, default=DEFAULT_TIMEOUT_SEC, help="HTTP timeout per request in seconds")
    parser.add_argument("--max-projects", type=int, default=100, help="Maximum number of projects to scan")
    parser.add_argument(
        "--project-id",
        action="append",
        default=[],
        help="Optional project_id filter (can be passed multiple times)",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    reindex = subparsers.add_parser("reindex", help="Reindex pending chunks based on local version snapshot")
    reindex.add_argument("--state-file", default=DEFAULT_REINDEX_STATE_FILE, help="Path to local chunk reindex snapshot state")
    reindex.add_argument("--max-chunks", type=int, default=600, help="Maximum chunk candidates scanned per run")

    resummarize = subparsers.add_parser("resummarize", help="Re-summarize stale sections/projects")
    resummarize.add_argument("--max-sections-per-project", type=int, default=400, help="Maximum sections scanned per project")

    memory = subparsers.add_parser("memory", help="Consolidate process memory by project")
    memory.add_argument("--similarity-threshold", type=float, default=0.96, help="Deduplication similarity threshold")
    memory.add_argument("--ttl-days", type=int, default=45, help="TTL days for low-priority no-usage items")
    memory.add_argument("--low-priority-max", type=int, default=200, help="Maximum priority eligible for TTL deactivation")
    memory.add_argument("--dry-run", action="store_true", help="Simulate consolidation without mutating memory state")

    subparsers.add_parser("consistency", help="Run consistency checks across /write domain")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "reindex":
        return run_reindex(args)
    if args.command == "resummarize":
        return run_resummarize(args)
    if args.command == "memory":
        return run_memory_consolidation(args)
    if args.command == "consistency":
        return run_consistency_check(args)

    raise WriteMaintenanceError(f"unsupported_command: {args.command}")


if __name__ == "__main__":
    try:
        sys.exit(main())
    except WriteMaintenanceError as exc:
        log("maintenance_failed", {"error": str(exc)})
        sys.exit(2)
    except KeyboardInterrupt:
        log("maintenance_interrupted", {})
        sys.exit(130)

