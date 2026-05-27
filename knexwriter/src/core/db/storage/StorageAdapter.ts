export interface StorageHealth {
  ok: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export interface StorageAdapter {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  transaction<T>(handler: () => Promise<T>): Promise<T>;
  migrate(): Promise<void>;
  seed?(): Promise<void>;
  healthCheck(): Promise<StorageHealth>;
}

