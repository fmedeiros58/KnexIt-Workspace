export type FileGuardHandleKind = "file" | "directory";

export type FileGuardHandleRecord = {
  id: string;
  projectId: string;
  kind: FileGuardHandleKind;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type FileGuardSourceCandidate = {
  name: string;
  type: import("../organization/organizationTypes").SourceFileType;
  fileHandleId?: string;
  directoryHandleId?: string;
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
  lastModified?: number;
  rootFolderName?: string;
};

export type FileSystemPermissionMode = "read" | "readwrite";

export type FileSystemPermissionDescriptorLike = {
  mode?: FileSystemPermissionMode;
};

export type FileSystemFileHandleLike = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  queryPermission?: (descriptor?: FileSystemPermissionDescriptorLike) => Promise<PermissionState>;
  requestPermission?: (descriptor?: FileSystemPermissionDescriptorLike) => Promise<PermissionState>;
};

export type FileSystemDirectoryHandleLike = {
  kind: "directory";
  name: string;
  entries?: () => AsyncIterableIterator<[string, FileSystemFileHandleLike | FileSystemDirectoryHandleLike]>;
  values?: () => AsyncIterableIterator<FileSystemFileHandleLike | FileSystemDirectoryHandleLike>;
  queryPermission?: (descriptor?: FileSystemPermissionDescriptorLike) => Promise<PermissionState>;
  requestPermission?: (descriptor?: FileSystemPermissionDescriptorLike) => Promise<PermissionState>;
};

export type FileGuardWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandleLike[]>;
  showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandleLike>;
};
