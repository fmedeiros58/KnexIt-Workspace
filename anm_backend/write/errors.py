"""
FILE: write/errors.py
RESPONSIBILITY: Domain exceptions for write workspace flows.
FLOW ROLE: Provide explicit, typed error contracts between repository/service/api layers.
READS: Runtime error context.
RAM WRITES: Exception instances only.
PERSISTS: None.
PRIMARY RISK: Losing conflict metadata if exceptions are replaced by generic errors.
"""

from __future__ import annotations


class WriteChunkVersionConflictError(RuntimeError):
    def __init__(
        self,
        *,
        chunk_id: str,
        client_version: int,
        server_version: int,
        server_updated_at: str,
    ) -> None:
        super().__init__(f"write chunk version conflict: {chunk_id}")
        self.chunk_id = chunk_id
        self.client_version = int(client_version)
        self.server_version = int(server_version)
        self.server_updated_at = server_updated_at

    def as_dict(self) -> dict[str, object]:
        return {
            "error": "write_chunk_version_conflict",
            "chunk_id": self.chunk_id,
            "client_version": self.client_version,
            "server_version": self.server_version,
            "server_updated_at": self.server_updated_at,
        }

