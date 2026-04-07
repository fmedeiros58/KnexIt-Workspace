type PathEnv = Record<string, string | undefined>;

const DEFAULT_MODEL_DIR_NAME = "CModelosMistral-7B-Instruct-v0.2-AWQ";

const DEFAULTS = {
  migrationsPath: "supabase/migrations",
  legacyMigrationsPath: "supabase/migrations_legacy",
  storageBasePath: "data",
  documentsBasePath: "docs",
  embeddingsBasePath: "models",
  tempWorkdirPath: ".tmp",
  exportsBasePath: "data/exports",
  anmCheckpointDir: "data/checkpoints",
} as const;

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const candidate = typeof value === "string" ? value.trim() : "";
    if (candidate) return candidate;
  }
  return "";
}

function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withSlashes = trimmed.replace(/\\/g, "/");
  return withSlashes.replace(/\/{2,}/g, "/");
}

function joinPosix(base: string, suffix: string) {
  const left = normalizePath(base).replace(/\/+$/, "");
  const right = normalizePath(suffix).replace(/^\/+/, "");
  if (!left) return right;
  if (!right) return left;
  return `${left}/${right}`;
}

function isAbsolutePathLike(value: string) {
  return value.startsWith("/") || /^[a-zA-Z]:\//.test(value) || value.startsWith("//");
}

function resolvePathWithNvme(
  rawValue: string | undefined,
  nvmeBasePath: string,
  defaultRelativePath: string,
) {
  const explicit = normalizePath(pickFirstNonEmpty(rawValue));
  if (explicit) return explicit;
  if (!nvmeBasePath) return defaultRelativePath;
  return joinPosix(nvmeBasePath, defaultRelativePath);
}

export type PathConfig = {
  nvmeBasePath: string;
  migrationsPath: string;
  knexAiMigrationFile: string;
  legacyMigrationsPath: string;
  storageBasePath: string;
  documentsBasePath: string;
  embeddingsBasePath: string;
  localLlmModelDefaultPath: string;
  tempWorkdirPath: string;
  exportsBasePath: string;
  anmCheckpointDir: string;
  ragRawDocumentsPath: string;
  ragExtractedTextPath: string;
  ragAdminBulkBasePath: string;
};

export function loadPathConfig(raw: PathEnv = process.env) {
  const nvmeBasePath = normalizePath(pickFirstNonEmpty(raw.NVME_BASE_PATH));
  const migrationsPath = normalizePath(
    resolvePathWithNvme(raw.MIGRATIONS_PATH, nvmeBasePath, DEFAULTS.migrationsPath),
  );
  const legacyMigrationsPath = normalizePath(
    resolvePathWithNvme(raw.LEGACY_MIGRATIONS_PATH, nvmeBasePath, DEFAULTS.legacyMigrationsPath),
  );
  const defaultKnexAiMigrationFile = joinPosix(
    migrationsPath,
    "20260302195000_create_knexai_unified_local.sql",
  );
  const knexAiMigrationFile = normalizePath(
    pickFirstNonEmpty(raw.KNEXAI_MIGRATION_FILE, defaultKnexAiMigrationFile),
  );

  const storageBasePath = normalizePath(
    resolvePathWithNvme(raw.STORAGE_BASE_PATH, nvmeBasePath, DEFAULTS.storageBasePath),
  );
  const documentsBasePath = normalizePath(
    resolvePathWithNvme(raw.DOCUMENTS_BASE_PATH, nvmeBasePath, DEFAULTS.documentsBasePath),
  );
  const embeddingsBasePath = normalizePath(
    resolvePathWithNvme(raw.EMBEDDINGS_BASE_PATH, nvmeBasePath, DEFAULTS.embeddingsBasePath),
  );
  const localLlmModelDefaultPath = normalizePath(
    pickFirstNonEmpty(
      raw.LOCAL_LLM_MODEL_DEFAULT,
      joinPosix(embeddingsBasePath, DEFAULT_MODEL_DIR_NAME),
    ),
  );
  const tempWorkdirPath = normalizePath(
    resolvePathWithNvme(raw.TEMP_WORKDIR_PATH, nvmeBasePath, DEFAULTS.tempWorkdirPath),
  );
  const exportsBasePath = normalizePath(
    resolvePathWithNvme(raw.EXPORTS_BASE_PATH, nvmeBasePath, DEFAULTS.exportsBasePath),
  );
  const anmCheckpointDir = normalizePath(
    resolvePathWithNvme(raw.AI_SYSTEM_ANM_CHECKPOINT_DIR, nvmeBasePath, DEFAULTS.anmCheckpointDir),
  );
  const ragRawDocumentsPath = normalizePath(
    pickFirstNonEmpty(raw.RAG_RAW_DOCUMENTS_PATH, joinPosix(storageBasePath, "rag/raw")),
  );
  const ragExtractedTextPath = normalizePath(
    pickFirstNonEmpty(raw.RAG_EXTRACTED_TEXT_PATH, joinPosix(storageBasePath, "rag/text")),
  );
  const ragAdminBulkBasePath = normalizePath(
    pickFirstNonEmpty(raw.RAG_ADMIN_BULK_BASE_PATH, joinPosix(storageBasePath, "rag/bulk")),
  );

  return {
    nvmeBasePath,
    migrationsPath,
    knexAiMigrationFile: isAbsolutePathLike(knexAiMigrationFile)
      ? knexAiMigrationFile
      : normalizePath(knexAiMigrationFile),
    legacyMigrationsPath,
    storageBasePath,
    documentsBasePath,
    embeddingsBasePath,
    localLlmModelDefaultPath,
    tempWorkdirPath,
    exportsBasePath,
    anmCheckpointDir,
    ragRawDocumentsPath,
    ragExtractedTextPath,
    ragAdminBulkBasePath,
  } satisfies PathConfig;
}
