-- KnexWriter cloud metadata schema (PostgreSQL draft)
-- UUID extension and indexing strategy can be tuned by infra layer.

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "ownerId" TEXT,
  status TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  "syncStatus" TEXT NOT NULL,
  "remoteId" TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  "lastSyncedAt" TIMESTAMPTZ,
  "deviceId" TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  title TEXT NOT NULL,
  "contentJson" JSONB,
  "contentHtml" TEXT,
  "contentPlainText" TEXT,
  "stylePreset" TEXT,
  "citationStyle" TEXT NOT NULL,
  "bibliographyStyle" TEXT NOT NULL,
  "lastOpenedAt" TIMESTAMPTZ,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  "syncStatus" TEXT NOT NULL,
  "remoteId" TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  "lastSyncedAt" TIMESTAMPTZ,
  "deviceId" TEXT
);

CREATE TABLE IF NOT EXISTS reference_sources (
  id UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  year TEXT,
  doi TEXT,
  isbn TEXT,
  issn TEXT,
  url TEXT,
  "reliabilityLevel" TEXT NOT NULL,
  "includeAsConsultedWork" BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL,
  "styleMetadataJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  "syncStatus" TEXT NOT NULL,
  "remoteId" TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  "lastSyncedAt" TIMESTAMPTZ,
  "deviceId" TEXT
);

CREATE TABLE IF NOT EXISTS citation_occurrences (
  id UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "referenceSourceId" UUID NOT NULL,
  "citationType" TEXT NOT NULL,
  "citationMode" TEXT NOT NULL,
  "citationText" TEXT,
  "quotedText" TEXT,
  "paraphraseText" TEXT,
  page TEXT,
  "pageStart" TEXT,
  "pageEnd" TEXT,
  status TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  "syncStatus" TEXT NOT NULL,
  "remoteId" TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  "lastSyncedAt" TIMESTAMPTZ,
  "deviceId" TEXT
);

CREATE TABLE IF NOT EXISTS generated_bibliography_entries (
  id UUID PRIMARY KEY,
  "projectId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "referenceSourceId" UUID NOT NULL,
  style TEXT NOT NULL,
  "formattedText" TEXT NOT NULL,
  "formattedHtml" TEXT,
  "sortKey" TEXT NOT NULL,
  "isIncluded" BOOLEAN NOT NULL DEFAULT TRUE,
  "generatedFromVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  "syncStatus" TEXT NOT NULL,
  "remoteId" TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  "lastSyncedAt" TIMESTAMPTZ,
  "deviceId" TEXT
);

