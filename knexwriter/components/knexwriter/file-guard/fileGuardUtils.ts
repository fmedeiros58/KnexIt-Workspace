import type { SourceFileType } from "../organization/organizationTypes";
import type {
  FileGuardSourceCandidate,
  FileSystemDirectoryHandleLike,
  FileSystemFileHandleLike,
  FileSystemPermissionDescriptorLike,
  FileGuardWindow,
} from "./fileGuardTypes";
import { saveDirectoryHandle, saveFileHandle } from "./fileGuardStore";

export function isFileSystemAccessSupported() {
  if (typeof window === "undefined") return false;
  const candidate = window as FileGuardWindow;
  return typeof candidate.showOpenFilePicker === "function" || typeof candidate.showDirectoryPicker === "function";
}

export async function requestProjectDirectoryAccess(projectId: string): Promise<{
  directoryHandleId: string;
  directoryName: string;
  sourceFiles: FileGuardSourceCandidate[];
}> {
  const picker = typeof window !== "undefined" ? (window as FileGuardWindow).showDirectoryPicker : undefined;
  if (!picker) {
    throw new Error("File System Access API indisponível para diretórios neste navegador.");
  }

  const directoryHandle = await picker.call(window, { mode: "read" });
  const directoryHandleId = await saveDirectoryHandle(projectId, directoryHandle);
  const sourceFiles = await collectDirectorySourceFiles(projectId, directoryHandle, directoryHandleId);

  return {
    directoryHandleId,
    directoryName: directoryHandle.name,
    sourceFiles,
  };
}

export async function requestSourceFilesAccess(projectId: string): Promise<FileGuardSourceCandidate[]> {
  const picker = typeof window !== "undefined" ? (window as FileGuardWindow).showOpenFilePicker : undefined;
  if (!picker) return [];

  const fileHandles = await picker.call(window, {
    multiple: true,
    types: [
      {
        description: "Fontes do projeto",
        accept: {
          "application/pdf": [".pdf"],
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
          "application/msword": [".doc"],
          "text/plain": [".txt"],
          "text/html": [".html", ".htm"],
          "image/*": [".png", ".jpg", ".jpeg", ".webp"],
        },
      },
    ],
  });

  const candidates: FileGuardSourceCandidate[] = [];
  for (const fileHandle of fileHandles) {
    const file = await fileHandle.getFile();
    const fileHandleId = await saveFileHandle(projectId, fileHandle);
    candidates.push(createSourceCandidateFromFile(file, { fileHandleId }));
  }

  return candidates;
}

export async function verifyFilePermission(fileHandle: FileSystemFileHandleLike) {
  if (!fileHandle.queryPermission) return "prompt" as PermissionState;
  return fileHandle.queryPermission({ mode: "read" });
}

export async function requestFilePermission(fileHandle: FileSystemFileHandleLike) {
  if (!fileHandle.requestPermission) return "granted" as PermissionState;
  return fileHandle.requestPermission({ mode: "read" });
}

export async function readSourceFileTextOrBlob(fileHandle: FileSystemFileHandleLike) {
  const permission = await ensurePermission(fileHandle);
  if (permission !== "granted") {
    throw new Error("Permissão para ler o arquivo não foi concedida.");
  }

  const file = await fileHandle.getFile();
  const textMimeTypes = ["text/", "application/json", "application/xml"];
  if (textMimeTypes.some((prefix) => file.type.startsWith(prefix))) {
    return { file, text: await file.text(), blob: file };
  }

  return { file, text: null, blob: file };
}

export function createSourceCandidateFromFile(
  file: File,
  ids: { fileHandleId?: string; directoryHandleId?: string; rootFolderName?: string } = {},
): FileGuardSourceCandidate {
  return {
    name: file.name,
    type: inferSourceFileType(file.type, file.name),
    fileHandleId: ids.fileHandleId,
    directoryHandleId: ids.directoryHandleId,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    lastModified: file.lastModified,
    rootFolderName: ids.rootFolderName,
  };
}

export function inferSourceFileType(mimeType: string, fileName = ""): SourceFileType {
  const normalized = `${mimeType} ${fileName}`.toLowerCase();
  if (normalized.includes("pdf")) return "pdf";
  if (normalized.includes("doc")) return "docx";
  if (normalized.includes("image") || /\.(png|jpe?g|webp|gif)$/i.test(fileName)) return "image";
  if (normalized.includes("xls") || normalized.includes("sheet") || normalized.includes("csv")) return "spreadsheet";
  if (/\.(bib|ris)$/i.test(fileName)) return "article";
  return "other";
}

async function collectDirectorySourceFiles(
  projectId: string,
  directoryHandle: FileSystemDirectoryHandleLike,
  directoryHandleId: string,
) {
  const sourceFiles: FileGuardSourceCandidate[] = [];
  const iterator = directoryHandle.values?.() ?? directoryHandle.entries?.();
  if (!iterator) return sourceFiles;

  for await (const entry of iterator) {
    const handle = Array.isArray(entry) ? entry[1] : entry;
    if (handle.kind !== "file") continue;

    const fileHandle = handle as FileSystemFileHandleLike;
    const file = await fileHandle.getFile();
    const fileHandleId = await saveFileHandle(projectId, fileHandle);
    sourceFiles.push(
      createSourceCandidateFromFile(file, {
        fileHandleId,
        directoryHandleId,
        rootFolderName: directoryHandle.name,
      }),
    );
  }

  return sourceFiles;
}

async function ensurePermission(fileHandle: FileSystemFileHandleLike) {
  const descriptor: FileSystemPermissionDescriptorLike = { mode: "read" };
  const current = fileHandle.queryPermission ? await fileHandle.queryPermission(descriptor) : "granted";
  if (current === "granted") return current;
  return fileHandle.requestPermission ? fileHandle.requestPermission(descriptor) : current;
}
