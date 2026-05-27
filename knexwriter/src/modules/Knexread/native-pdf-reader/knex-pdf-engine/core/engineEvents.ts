import type {
  KnexPdfBackendId,
  KnexPdfHorizontalOverflowState,
  KnexPdfRulerState,
} from "./engineTypes";
import type { KnexPdfBackendSelectionMode } from "./engineState";

export type KnexPdfEngineEvent =
  | {
      type: "document-loaded";
      pageCount: number;
    }
  | {
      type: "page-render-scheduled";
      pageNumber: number;
      renderVersion: number;
    }
  | {
      type: "page-rendered";
      pageNumber: number;
      renderVersion: number;
    }
  | {
      type: "zoom-changed";
      zoom: number;
      layoutVersion: number;
    }
  | {
      type: "overflow-updated";
      overflow: KnexPdfHorizontalOverflowState;
    }
  | {
      type: "ruler-synced";
      ruler: KnexPdfRulerState;
    }
  | {
      type: "backend-changed";
      preferredBackend: KnexPdfBackendSelectionMode;
      activeBackend: KnexPdfBackendId;
      previousBackend?: KnexPdfBackendId;
      renderVersion: number;
    }
  | {
      type: "backend-fallback";
      requestedBackend: KnexPdfBackendSelectionMode;
      failedBackend: KnexPdfBackendId | string;
      fallbackBackend: KnexPdfBackendId;
      reason: string;
      renderVersion: number;
    }
  | {
      type: "backend-error";
      backend: KnexPdfBackendId | string;
      reason: string;
      error?: unknown;
      renderVersion: number;
    };

export type KnexPdfEngineEventListener = (
  event: KnexPdfEngineEvent,
) => void;