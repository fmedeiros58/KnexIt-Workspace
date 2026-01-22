export type SupaDriveRecordingMeta = {
  id: number;
  name?: string;
  size: number;
  createdAt: number;
  mime?: string;
  ext?: string;
  owner?: string;
  people?: string[];
  anyone?: boolean;
  source?: string;
  starred?: boolean;
  trashed?: boolean;
  spam?: boolean;
  color?: string;
  parentId?: number | null;
};
