"use client";

export type DriveRecordingMeta = {
  id: number;
  name: string;
  size: number;
  createdAt: number;
  mime?: string;
  ext?: string;
  owner?: string; // email ou "eu"
  people?: string[]; // emails compartilhados
  anyone?: boolean; // compartilhado com link
  source?: string; // 'gmail' | 'meet' | ...
  starred?: boolean;
  trashed?: boolean;
  spam?: boolean;
  color?: string; // cor da pasta (quando for pasta)
};

const DB_NAME = "upconect-drive";
const DB_VERSION = 2;
const STORE = "recordings";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        os.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording(name: string, blob: Blob): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    const createdAt = Date.now();
    const size = blob.size;
    const mime = blob.type || "";
    const ext = getExt(name);
    const owner = (typeof localStorage !== "undefined" && localStorage.getItem("drive:selfEmail")) || "eu";
    const source = "upconect"; // padrão para gravações feitas no UpConect
    const req = os.add({
      name,
      size,
      createdAt,
      mime,
      ext,
      owner,
      people: [],
      anyone: false,
      source,
      starred: false,
      trashed: false,
      spam: false,
      blob,
    });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

// Cria uma pasta (registro especial) no Drive local
export async function saveFolder(name: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    const createdAt = Date.now();
    const size = 0;
    const mime = "inode/directory";
    const ext = "folder";
    const owner = (typeof localStorage !== "undefined" && localStorage.getItem("drive:selfEmail")) || "eu";
    const source = "folder";
    const blob = new Blob([], { type: mime });
    const req = os.add({
      name,
      size,
      createdAt,
      mime,
      ext,
      owner,
      people: [],
      anyone: false,
      source,
      starred: false,
      trashed: false,
      spam: false,
      blob,
    });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function listRecordings(): Promise<DriveRecordingMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const os = tx.objectStore(STORE);
    const req = os.getAll();
    req.onsuccess = () => {
      const rows = (req.result as any[]).map((r) => ({
        id: r.id as number,
        name: r.name as string,
        size: r.size as number,
        createdAt: r.createdAt as number,
        mime: (r as any).mime as string | undefined,
        ext: ((r as any).ext as string | undefined) ?? getExt(r.name as string),
        owner: (r as any).owner as string | undefined,
        people: ((r as any).people as string[] | undefined) ?? [],
        anyone: ((r as any).anyone as boolean | undefined) ?? false,
        source: (r as any).source as string | undefined,
        starred: (r as any).starred as boolean | undefined,
        trashed: (r as any).trashed as boolean | undefined,
        spam: (r as any).spam as boolean | undefined,
        color: (r as any).color as string | undefined,
      }));
      rows.sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getRecordingBlob(id: number): Promise<Blob> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const os = tx.objectStore(STORE);
    const req = os.get(id);
    req.onsuccess = () => {
      const row = req.result as any;
      if (!row) return reject(new Error("not found"));
      resolve(row.blob as Blob);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRecording(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    const req = os.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  if (i === -1) return "";
  return name.slice(i + 1).toLowerCase();
}

// Atualiza campos arbitrários (patch) do item
export async function patchRecording(
  id: number,
  patch: Partial<Pick<DriveRecordingMeta, "name" | "owner" | "people" | "anyone" | "source" | "color">> &
    Partial<{ starred: boolean; trashed: boolean; spam: boolean }>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    const getReq = os.get(id);
    getReq.onsuccess = () => {
      const row = getReq.result as any;
      if (!row) return reject(new Error("not found"));
      const next = { ...row, ...patch };
      const putReq = os.put(next);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
