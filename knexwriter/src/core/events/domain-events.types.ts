import type { UUID } from "../db/db.types";

export type DomainEventName =
  | "ProjectCreated"
  | "DocumentCreated"
  | "FileAssetAdded"
  | "ProjectFileLinked"
  | "ReferenceSourceCreated"
  | "ReferenceSourceUpdated"
  | "CitationOccurrenceCreated"
  | "CitationOccurrenceDeleted"
  | "CitationOccurrenceMarkedUnused"
  | "PdfAnnotationCreated"
  | "PdfAnnotationLinkedToCitation"
  | "BibliographyNeedsRegeneration"
  | "BibliographyRegenerated"
  | "FileTextExtractionCompleted"
  | "SyncRequired";

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  name: DomainEventName;
  occurredAt: string;
  projectId?: UUID;
  documentId?: UUID;
  payload: TPayload;
}

export type DomainEventHandler<TPayload = Record<string, unknown>> = (event: DomainEvent<TPayload>) => void | Promise<void>;

