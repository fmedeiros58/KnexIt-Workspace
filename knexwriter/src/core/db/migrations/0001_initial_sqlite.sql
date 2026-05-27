-- KnexWriter local-first schema (SQLite draft)
-- This migration is intentionally conservative and can be expanded per release.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  ownerId TEXT,
  status TEXT NOT NULL,
  metadataJson TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  syncStatus TEXT NOT NULL,
  remoteId TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  lastSyncedAt TEXT,
  deviceId TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  title TEXT NOT NULL,
  contentJson TEXT,
  contentHtml TEXT,
  contentPlainText TEXT,
  stylePreset TEXT,
  citationStyle TEXT NOT NULL,
  bibliographyStyle TEXT NOT NULL,
  lastOpenedAt TEXT,
  metadataJson TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  syncStatus TEXT NOT NULL,
  remoteId TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  lastSyncedAt TEXT,
  deviceId TEXT
);

CREATE TABLE IF NOT EXISTS reference_sources (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  year TEXT,
  doi TEXT,
  isbn TEXT,
  issn TEXT,
  url TEXT,
  reliabilityLevel TEXT NOT NULL,
  includeAsConsultedWork INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  styleMetadataJson TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  syncStatus TEXT NOT NULL,
  remoteId TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  lastSyncedAt TEXT,
  deviceId TEXT
);

CREATE TABLE IF NOT EXISTS citation_occurrences (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  documentId TEXT NOT NULL,
  referenceSourceId TEXT NOT NULL,
  citationType TEXT NOT NULL,
  citationMode TEXT NOT NULL,
  citationText TEXT,
  quotedText TEXT,
  paraphraseText TEXT,
  page TEXT,
  pageStart TEXT,
  pageEnd TEXT,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  syncStatus TEXT NOT NULL,
  remoteId TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  lastSyncedAt TEXT,
  deviceId TEXT
);

CREATE TABLE IF NOT EXISTS generated_bibliography_entries (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  documentId TEXT NOT NULL,
  referenceSourceId TEXT NOT NULL,
  style TEXT NOT NULL,
  formattedText TEXT NOT NULL,
  formattedHtml TEXT,
  sortKey TEXT NOT NULL,
  isIncluded INTEGER NOT NULL DEFAULT 1,
  generatedFromVersion INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  syncStatus TEXT NOT NULL,
  remoteId TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  lastSyncedAt TEXT,
  deviceId TEXT
);

