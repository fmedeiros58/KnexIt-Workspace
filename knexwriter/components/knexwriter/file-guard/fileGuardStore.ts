import type {
  FileGuardHandleKind,
  FileGuardHandleRecord,
  FileSystemDirectoryHandleLike,
  FileSystemFileHandleLike,
} from "./fileGuardTypes";

const DB_NAME = "knexwriter-file-guard";
const DB_VERSION = 1;
const HANDLE_STORE = "handles";
const HANDLE_META_STORE = "handleMetadata";

type PersistedHandle = FileSystemFileHandleLike | FileSystemDirectoryHandleLike;

export async function saveFileHandle(projectId: string, fileHandle: FileSystemFileHandleLike) {
  return saveHandle(projectId, "file", fileHandle.name, fileHandle);
}

export async function saveDirectoryHandle(projectId: string, directoryHandle: FileSystemDirectoryHandleLike) {
  return saveHandle(projectId, "directory", directoryHandle.name, directoryHandle);
}

export async function restoreFileHandle(handleId: string) {
  const handle = await getFromStore<PersistedHandle>(HANDLE_STORE, handleId);
  return handle?.kind === "file" ? (handle as FileSystemFileHandleLike) : null;
}

export async function restoreDirectoryHandle(handleId: string) {
  const handle = await getFromStore<PersistedHandle>(HANDLE_STORE, handleId);
  return handle?.kind === "directory" ? (handle as FileSystemDirectoryHandleLike) : null;
}

export async function getHandleMetadata(handleId: string) {
  return getFromStore<FileGuardHandleRecord>(HANDLE_META_STORE, handleId);
}

async function saveHandle(
  projectId: string,
  kind: FileGuardHandleKind,
  name: string,
  handle: PersistedHandle,
) {
  const id = `${kind}-${projectId}-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const metadata: FileGuardHandleRecord = {
    id,
    projectId,
    kind,
    name,
    createdAt: now,
    updatedAt: now,
  };

  const db = await openFileGuardDb();
  await runTransaction(db, HANDLE_STORE, "readwrite", (store) => store.put(handle, id));
  await runTransaction(db, HANDLE_META_STORE, "readwrite", (store) => store.put(metadata, id));
  db.close();

  return id;
}

async function getFromStore<T>(storeName: string, key: string) {
  const db = await openFileGuardDb();
  const value = await runTransaction<T | undefined>(db, storeName, "readonly", (store) => store.get(key));
  db.close();
  return value ?? null;
}

function openFileGuardDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
      if (!db.objectStoreNames.contains(HANDLE_META_STORE)) db.createObjectStore(HANDLE_META_STORE);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir IndexedDB de arquivos."));
  });
}

function runTransaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operação IndexedDB falhou."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Transação IndexedDB falhou."));
  });
}
