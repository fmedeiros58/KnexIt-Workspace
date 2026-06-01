import type { KnexPdfBackendSelectionMode } from "../core/engineState";
import type { KnexPdfBackendId } from "../core/engineTypes";
import type {
  PdfBackendCapabilities,
  PdfRenderBackend,
} from "./PdfRenderBackend";
import { BackendRegistry } from "./BackendRegistry";

export type BackendSelectionResult = {
  requestedBackend: KnexPdfBackendSelectionMode;
  activeBackend: KnexPdfBackendId;
  backend: PdfRenderBackend;
  fallbackUsed: boolean;
  failedBackend?: KnexPdfBackendId | string;
  reason?: string;
};

type BackendAttemptFailure = {
  backendId: KnexPdfBackendId | string;
  reason: string;
};

const AUTO_BACKEND_ORDER: KnexPdfBackendId[] = [
  "pdfjs", // Default backend - always available
  // TODO: "pdfium" - add when PDFium backend is implemented (Phase 3)
];

function createUnavailableCapabilities(reason: string): PdfBackendCapabilities {
  return {
    available: false,
    renderPage: false,
    extractText: false,
    extractAnnotations: false,
    cancellation: false,
    hiDpi: false,
    tileRendering: false,
    worker: false,
    reason,
  };
}

function isKnownBackendId(id: string): id is KnexPdfBackendId {
  // Current known backends: only pdfjs is active
  // TODO: Add "pdfium" when backend is implemented
  return id === "pdfjs" || id === "pdfium"; // pdfium kept for type compatibility, not yet implemented
}

function describeFailures(
  failures: BackendAttemptFailure[],
): string | undefined {
  if (failures.length === 0) return undefined;

  return failures
    .map((failure) => `${failure.backendId}: ${failure.reason}`)
    .join("; ");
}

function getFallbackReason(input: {
  requestedBackend: KnexPdfBackendSelectionMode;
  failures: BackendAttemptFailure[];
}): string | undefined {
  if (input.failures.length === 0) return undefined;

  if (input.requestedBackend !== "auto") {
    return input.failures[0]?.reason;
  }

  return describeFailures(input.failures);
}

export class BackendSelector {
  constructor(private readonly registry: BackendRegistry) {}

  async select(
    preferredBackend: KnexPdfBackendSelectionMode,
  ): Promise<BackendSelectionResult> {
    const requestedBackend = preferredBackend;
    const orderedBackendIds =
      preferredBackend === "auto"
        ? AUTO_BACKEND_ORDER
        : [preferredBackend, "pdfjs"].filter(
            (id, index, values) => values.indexOf(id) === index,
          );

    const failures: BackendAttemptFailure[] = [];

    for (const backendId of orderedBackendIds) {
      const backend = this.registry.get(backendId);

      if (!backend) {
        failures.push({
          backendId,
          reason: "Backend is not registered.",
        });
        continue;
      }

      const capabilities = await this.getCapabilities(backend);

      if (!capabilities.available) {
        failures.push({
          backendId,
          reason: capabilities.reason ?? "Backend is not available.",
        });
        continue;
      }

      if (!isKnownBackendId(backend.id)) {
        failures.push({
          backendId: backend.id,
          reason: "Backend id is not supported by KnexPDF state.",
        });
        continue;
      }

      const fallbackUsed =
        requestedBackend === "auto"
          ? failures.length > 0
          : requestedBackend !== backend.id;
      const failed = failures[0];

      return {
        requestedBackend,
        activeBackend: backend.id,
        backend,
        fallbackUsed,
        failedBackend: fallbackUsed ? failed?.backendId : undefined,
        reason: fallbackUsed
          ? getFallbackReason({ requestedBackend, failures })
          : capabilities.reason,
      };
    }

    throw new Error(
      `No KnexPDF backend is available. ${
        describeFailures(failures) ?? ""
      }`.trim(),
    );
  }

  private async getCapabilities(
    backend: PdfRenderBackend,
  ): Promise<PdfBackendCapabilities> {
    try {
      return backend.getCapabilities
        ? await backend.getCapabilities()
        : createUnavailableCapabilities("Backend does not expose capabilities.");
    } catch (error) {
      return createUnavailableCapabilities(
        error instanceof Error
          ? error.message
          : "Backend capability check failed.",
      );
    }
  }
}
