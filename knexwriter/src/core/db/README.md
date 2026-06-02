# KnexWriter DB Architecture (Local-First)

## Purpose
This module defines the persistence foundation for KnexWriter in three future scenarios:

1. Web/PWA with offline-first behavior.
2. Desktop app with offline-first behavior.
3. Internet-synced mode (OneDrive-like workflow).

All database code lives inside the KnexWriter tree under `src/core/db`:
- models/types
- schemas/migrations
- repositories
- adapters
- services
- sync contracts/engine

No feature should access IndexedDB/SQLite/Postgres directly.

## Core Principles
- Local-first by default: app must work without internet.
- Separation of structured data and large files.
- Strict layering:
  - Feature -> Service -> Repository -> Storage Adapter
- Bibliographic source is a structured object (not a plain string).
- Citation occurrence is an entity (not only typed text).

## Runtime Storage Strategy

### PWA
- Structured data: IndexedDB (`IndexedDbStorageAdapter`)
- Large files: OPFS (`OpfsFileStorageAdapter`)
- Logical tree (simulated):
  - `/knexwriter/projects/{projectId}/.knexwriter/project-db`
  - `/knexwriter/projects/{projectId}/files/...`
  - `/knexwriter/projects/{projectId}/cache/...`

### Desktop
- Structured data: SQLite (`SQLiteStorageAdapter`)
- Large files: local filesystem (`DesktopFileStorageAdapter`)
- Expected project layout:
  - `KnexWriterProjects/{projectId}/.knexwriter/project.db`
  - `KnexWriterProjects/{projectId}/.knexwriter/manifest.json`
  - `KnexWriterProjects/{projectId}/.knexwriter/sync-state.json`
  - `KnexWriterProjects/{projectId}/files/...`
  - `KnexWriterProjects/{projectId}/cache/...`

### Cloud
- Structured data: PostgreSQL (`PostgresStorageAdapter`)
- Large files: object storage (`CloudFileStorageAdapter`)
  - S3 / R2 / Azure Blob / OneDrive / Google Drive (future remote clients)
- Binary files (PDF, images, audio, video) must not be persisted directly in relational rows.

## Automatic Bibliography Rule
`BibliographyService` enforces:
- A `ReferenceSource` enters final bibliography if the current document has at least one active `CitationOccurrence` for that source.
- It also enters if `includeAsConsultedWork = true`.
- If all active citations are removed/inactivated, source leaves bibliography unless `includeAsConsultedWork = true`.

## Citation as Internal Hyperlink
`DocumentCitationLink` stores clickable links in editor content:
- `citationOccurrenceId`
- `documentId`
- `displayText`
- `href` (example: `knexwriter://citation/{citationOccurrenceId}`)

This is the base for future "open citation in PDF exact location".

## Future PDF Reader Integration
Persistence is already prepared through:
- `PdfAnnotation`
- `PdfAnchor`
- `CitationLocator`
- `ReferenceAttachment`
- `FileTextIndex`

Stored data already supports:
- page number and label
- selected text and text context (`textBefore`, `matchedText`, `textAfter`)
- rectangle coordinates (`rectsJson`)
- links between citation, reference, file and annotation

## Sync Foundation
The sync base includes:
- `SyncEngine`
- `SyncQueue`
- `LocalChangeTracker`
- `RemoteSyncClient`
- `ConflictResolver`
- `SyncChangeLog`

Conflict strategies already typed:
- `last_write_wins`
- `manual_merge`
- `keep_local`
- `keep_remote`
- `field_level_merge`

## Domain Events
`DomainEventBus` and typed events support:
- source creation/update
- citation creation/delete/mark unused
- bibliography regeneration triggers
- sync-required signaling

Examples:
- `CitationOccurrenceCreated` -> emits `BibliographyNeedsRegeneration`
- `CitationOccurrenceMarkedUnused` -> emits `BibliographyNeedsRegeneration`
- `ReferenceSourceUpdated` -> emits `BibliographyNeedsRegeneration`

## Current Scope of This Phase
Implemented in this phase:
- canonical DB types/entities
- schema contracts
- initial SQL migrations (SQLite/PostgreSQL)
- repository interfaces
- storage adapters as skeleton contracts
- service layer contracts and base business rules
- initial ABNT/APA formatter interface/service
- validation service foundation
- sync engine foundation

Not implemented yet in this phase:
- final production adapter implementations
- UI for conflict resolution
- complete native PDF reader behavior
- full export/import tooling (BibTeX/RIS/EndNote XML)

