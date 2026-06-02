export const KNEXWRITER_DB_VERSION = "0.1.0";

export const KNEXWRITER_DB_NAME = "knexwriter-local";
export const KNEXWRITER_SYNC_QUEUE_NAME = "knexwriter-sync-queue";

export const KNEXWRITER_DESKTOP_PROJECT_LAYOUT = {
  rootFolderName: "KnexWriterProjects",
  metadataFolderName: ".knexwriter",
  sqliteFileName: "project.db",
  manifestFileName: "manifest.json",
  syncStateFileName: "sync-state.json",
  filesFolderName: "files",
  exportsFolderName: "exports",
  cacheFolderName: "cache",
} as const;

export const KNEXWRITER_DEFAULT_CITATION_STYLE = "ABNT" as const;
export const KNEXWRITER_DEFAULT_BIBLIOGRAPHY_STYLE = "ABNT" as const;

export const KNEXWRITER_MAX_BULK_SYNC_ITEMS = 200;

