"use client";

import {
  createContext,
  useEffect,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { KnexPdfEngine } from "./KnexPdfEngine";
import type {
  KnexPdfBackendSelectionMode,
  KnexPdfEngineState,
} from "./core/engineState";

const KnexPdfEngineContext = createContext<KnexPdfEngine | null>(null);

const BACKEND_SELECTION_MODES = new Set<KnexPdfBackendSelectionMode>([
  "auto",
  "pdfjs",
  "pdfium",
]);

/**
 * Ajuste temporário para teste visual.
 *
 * Como o PDFium já está em settled-final/extreme/ratio alto e mesmo assim
 * ainda apresenta serrilhado, precisamos comparar a renderização visual com
 * PDF.js.
 *
 * Este fallback força o backend padrão para PDF.js quando nenhum valor foi
 * configurado explicitamente por:
 * - globalThis.KNEX_PDF_DEFAULT_BACKEND
 * - globalThis.__KNEX_PDF_DEFAULT_BACKEND__
 * - localStorage["KNEX_PDF_DEFAULT_BACKEND"]
 * - NEXT_PUBLIC_KNEX_PDF_DEFAULT_BACKEND
 *
 * Para voltar ao comportamento antigo, troque para "auto" ou "pdfium".
 */
const FALLBACK_VISUAL_BACKEND_FOR_TEST: KnexPdfBackendSelectionMode = "pdfjs";

function normalizeBackendSelectionMode(
  value: unknown,
): KnexPdfBackendSelectionMode | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();

  return BACKEND_SELECTION_MODES.has(
    normalized as KnexPdfBackendSelectionMode,
  )
    ? (normalized as KnexPdfBackendSelectionMode)
    : null;
}

function getConfiguredDefaultBackend(): KnexPdfBackendSelectionMode | null {
  const globalRecord = globalThis as unknown as Record<string, unknown>;

  const globalBackend =
    normalizeBackendSelectionMode(globalRecord.KNEX_PDF_DEFAULT_BACKEND) ??
    normalizeBackendSelectionMode(globalRecord.__KNEX_PDF_DEFAULT_BACKEND__);

  if (globalBackend) return globalBackend;

  /**
   * Permite trocar o backend sem recompilar.
   *
   * No console:
   * localStorage.setItem("KNEX_PDF_DEFAULT_BACKEND", "pdfjs");
   * location.reload();
   *
   * Para testar PDFium:
   * localStorage.setItem("KNEX_PDF_DEFAULT_BACKEND", "pdfium");
   * location.reload();
   *
   * Para voltar ao fallback deste arquivo:
   * localStorage.removeItem("KNEX_PDF_DEFAULT_BACKEND");
   * location.reload();
   */
  try {
    const localBackend = normalizeBackendSelectionMode(
      globalThis.localStorage?.getItem("KNEX_PDF_DEFAULT_BACKEND"),
    );

    if (localBackend) return localBackend;
  } catch {
    // localStorage pode estar indisponível em alguns ambientes.
  }

  const envBackend =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_KNEX_PDF_DEFAULT_BACKEND
      : undefined;

  const normalizedEnvBackend = normalizeBackendSelectionMode(envBackend);

  if (normalizedEnvBackend) return normalizedEnvBackend;

  return FALLBACK_VISUAL_BACKEND_FOR_TEST;
}

export function KnexPdfEngineProvider({
  children,
  engine,
}: {
  children: ReactNode;
  engine?: KnexPdfEngine;
}) {
  /**
   * useRef evita recriar o engine em re-renderizações.
   * Isso é importante porque o engine guarda estado, listeners e versões.
   */
  const internalEngineRef = useRef<KnexPdfEngine | null>(null);

  if (!internalEngineRef.current) {
    internalEngineRef.current = new KnexPdfEngine();
  }

  const resolvedEngine = engine ?? internalEngineRef.current;

  useEffect(() => {
    const preferredBackend =
      getConfiguredDefaultBackend() ?? resolvedEngine.getPreferredBackend();

    void resolvedEngine.resolveActiveBackend(preferredBackend).catch((error) => {
      resolvedEngine.reportBackendError({
        backend: preferredBackend,
        reason:
          error instanceof Error
            ? error.message
            : "Failed to resolve the preferred PDF backend.",
        error,
      });
    });
  }, [resolvedEngine]);

  return (
    <KnexPdfEngineContext.Provider value={resolvedEngine}>
      {children}
    </KnexPdfEngineContext.Provider>
  );
}

export function useKnexPdfEngine(): KnexPdfEngine {
  const engine = useContext(KnexPdfEngineContext);

  if (!engine) {
    throw new Error(
      "useKnexPdfEngine must be used inside KnexPdfEngineProvider.",
    );
  }

  return engine;
}

/**
 * Hook opcional para componentes que precisam reagir a mudanças do engine.
 *
 * Exemplo:
 * const engineState = useKnexPdfEngineState();
 * const zoom = engineState.zoom;
 */
export function useKnexPdfEngineState(): KnexPdfEngineState {
  const engine = useKnexPdfEngine();

  return useSyncExternalStore(
    engine.subscribe.bind(engine),
    () => engine.getState(),
    () => engine.getState(),
  );
}
