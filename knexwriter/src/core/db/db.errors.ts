export class KnexWriterDbError extends Error {
  constructor(message: string, public readonly code: string, public readonly causeData?: unknown) {
    super(message);
    this.name = "KnexWriterDbError";
  }
}

export class ValidationDbError extends KnexWriterDbError {
  constructor(message: string, causeData?: unknown) {
    super(message, "VALIDATION_ERROR", causeData);
    this.name = "ValidationDbError";
  }
}

export class NotFoundDbError extends KnexWriterDbError {
  constructor(message: string, causeData?: unknown) {
    super(message, "NOT_FOUND", causeData);
    this.name = "NotFoundDbError";
  }
}

export class ConflictDbError extends KnexWriterDbError {
  constructor(message: string, causeData?: unknown) {
    super(message, "CONFLICT", causeData);
    this.name = "ConflictDbError";
  }
}

export class SyncDbError extends KnexWriterDbError {
  constructor(message: string, causeData?: unknown) {
    super(message, "SYNC_ERROR", causeData);
    this.name = "SyncDbError";
  }
}

