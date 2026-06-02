"use client";

import {
  ChevronDown,
  FileUp,
  FolderOpen,
  Minus,
  Search,
  Square,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  KNEXREAD_GUIDES_BAR_HEIGHT,
  KnexreadRibbon,
  KnexreadTabs,
  PdfFileBackstage,
  PdfHomePage,
  KnexreadShell,
  consumeKnexreadLaunch,
  pdfReaderController,
  pdfReaderRepository,
  resolvePdfFileBlob,
} from "..";
import type {
  PdfReaderRibbonTab,
  PdfTranslationStrategy,
  PdfTranslationViewMode,
} from "..";

type KnexreadRouteContext = {
  launchId?: string;
  pdfFileId?: string;
  projectId?: string;
  documentId?: string;
  sourceId?: string;
  sourceName?: string;
};

type FileBackstageSection =
  | "propriedades"
  | "criar"
  | "abrir"
  | "salvar"
  | "salvar-como"
  | "exportar"
  | "imprimir"
  | "compartilhar"
  | "fechar"
  | "preferencias";

type KnexreadOpenGuide =
  | {
      id: "home";
      kind: "home";
      title: "Iniciar";
    }
  | {
      id: string;
      kind: "pdf";
      title: string;
      file?: File;
      pdfFileId?: string;
      projectId: string;
      documentId?: string;
      sourceId?: string;
      sourceName?: string;
    };

const DEFAULT_PROJECT_ID = "local-knexwriter";

function createLocalGuideId(file: File) {
  return `local:${file.name}:${file.size}:${file.lastModified}:${Date.now()}`;
}

export default function KnexreadWebPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const routeContext = useMemo<KnexreadRouteContext>(
    () => ({
      launchId: searchParams.get("launchId") ?? undefined,
      pdfFileId: searchParams.get("pdfFileId") ?? undefined,
      projectId: searchParams.get("projectId") ?? undefined,
      documentId: searchParams.get("documentId") ?? undefined,
      sourceId: searchParams.get("sourceId") ?? undefined,
      sourceName: searchParams.get("sourceName") ?? undefined,
    }),
    [searchParams],
  );

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openGuides, setOpenGuides] = useState<KnexreadOpenGuide[]>([
    { id: "home", kind: "home", title: "Iniciar" },
  ]);
  const [activeGuideId, setActiveGuideId] = useState<string>("home");
  const [landingTab, setLandingTab] = useState<PdfReaderRibbonTab>("inicio");
  const [landingFileSection, setLandingFileSection] =
    useState<FileBackstageSection>("abrir");
  const [landingViewMode, setLandingViewMode] =
    useState<PdfTranslationViewMode>("normal");
  const [landingStrategy, setLandingStrategy] =
    useState<PdfTranslationStrategy>("local-first");
  const [landingSourceLanguage, setLandingSourceLanguage] = useState("auto");
  const [landingTargetLanguage, setLandingTargetLanguage] = useState("pt-BR");
  const [landingShowRuler, setLandingShowRuler] = useState(true);
  const [landingShowMargins, setLandingShowMargins] = useState(true);
  const [landingShowViewportCenter, setLandingShowViewportCenter] = useState(false);
  const [landingShowPageCenter, setLandingShowPageCenter] = useState(false);
  const [landingShowTextLayer, setLandingShowTextLayer] = useState(false);
  const [landingShowOcrDebugBoxes, setLandingShowOcrDebugBoxes] = useState(false);
  const [recentFiles, setRecentFiles] = useState<Array<Awaited<ReturnType<typeof pdfReaderController.listProjectFiles>>[number]>>([]);
  const [activeProjectId, setActiveProjectId] = useState(
    routeContext.projectId ?? DEFAULT_PROJECT_ID,
  );
  const [activeDocumentId, setActiveDocumentId] = useState<string | undefined>(
    routeContext.documentId,
  );
  const [activeSourceId, setActiveSourceId] = useState<string | undefined>(
    routeContext.sourceId,
  );
  const [resolvedSourceName, setResolvedSourceName] = useState<string | undefined>(
    routeContext.sourceName,
  );

  const upsertPdfGuide = useCallback((guide: Extract<KnexreadOpenGuide, { kind: "pdf" }>) => {
    setOpenGuides((current) => {
      const exists = current.find((item) => item.id === guide.id);
      if (exists) {
        return current.map((item) => (item.id === guide.id ? guide : item));
      }
      return [...current, guide];
    });
  }, []);

  const openPdfGuideFromFile = useCallback(
    (input: {
      file: File;
      projectId?: string;
      documentId?: string;
      sourceId?: string;
      sourceName?: string;
      pdfFileId?: string;
    }) => {
      const projectId = input.projectId ?? routeContext.projectId ?? DEFAULT_PROJECT_ID;
      const guideId = input.pdfFileId ?? createLocalGuideId(input.file);
      const title = input.sourceName ?? input.file.name;

      setLoadError(null);
      setIsLoadingFile(false);
      setActiveFile(input.file);
      upsertPdfGuide({
        id: guideId,
        kind: "pdf",
        title,
        file: input.file,
        pdfFileId: input.pdfFileId,
        projectId,
        documentId: input.documentId ?? routeContext.documentId,
        sourceId: input.sourceId ?? routeContext.sourceId,
        sourceName: title,
      });
      setActiveGuideId(guideId);
      setActiveProjectId(projectId);
      setActiveDocumentId(input.documentId ?? routeContext.documentId);
      setActiveSourceId(input.sourceId ?? routeContext.sourceId);
      setResolvedSourceName(title);
    },
    [
      routeContext.documentId,
      routeContext.projectId,
      routeContext.sourceId,
      upsertPdfGuide,
    ],
  );

  useEffect(() => {
    const isPdfRenderCancellation = (reason: unknown) => {
      const maybe = reason as { name?: unknown; message?: unknown } | undefined;
      const name = typeof maybe?.name === "string" ? maybe.name : "";
      const message = typeof maybe?.message === "string" ? maybe.message : "";
      return (
        name === "AbortError" ||
        name === "RenderingCancelledException" ||
        /rendering cancelled|render canceled|render aborted/i.test(message)
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isPdfRenderCancellation(event.reason)) return;

      event.preventDefault();
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (!isPdfRenderCancellation(event.error) && !isPdfRenderCancellation(event)) {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const projectId = routeContext.projectId ?? DEFAULT_PROJECT_ID;
    const loadRecentFiles = async () => {
      try {
        const items = await pdfReaderController.listProjectFiles(projectId);
        if (cancelled) return;
        setRecentFiles(items.slice(0, 50));
      } catch {
        if (cancelled) return;
        setRecentFiles([]);
      }
    };
    void loadRecentFiles();
    return () => {
      cancelled = true;
    };
  }, [routeContext.projectId, activeFile]);

  useEffect(() => {
    let cancelled = false;

    const loadFromRoute = async () => {
      if (routeContext.launchId) {
        const launchPayload = consumeKnexreadLaunch(routeContext.launchId);
        if (launchPayload) {
          if (cancelled) return;
          setActiveFile(launchPayload.file);
          const launchGuideId = `launch:${routeContext.launchId ?? Date.now()}`;
          upsertPdfGuide({
            id: launchGuideId,
            kind: "pdf",
            title: launchPayload.sourceName ?? launchPayload.file.name,
            file: launchPayload.file,
            projectId: launchPayload.projectId ?? DEFAULT_PROJECT_ID,
            documentId: launchPayload.documentId,
            sourceId: launchPayload.sourceId,
            sourceName: launchPayload.sourceName ?? launchPayload.file.name,
          });
          setActiveGuideId(launchGuideId);
          setActiveProjectId(launchPayload.projectId ?? DEFAULT_PROJECT_ID);
          setActiveDocumentId(launchPayload.documentId);
          setActiveSourceId(launchPayload.sourceId);
          setResolvedSourceName(
            launchPayload.sourceName ?? launchPayload.file.name,
          );
          setIsLoadingFile(false);
          setLoadError(null);
          return;
        }
      }

      if (!routeContext.pdfFileId) {
        setIsLoadingFile(false);
        setLoadError(null);
        setActiveProjectId(routeContext.projectId ?? DEFAULT_PROJECT_ID);
        setActiveDocumentId(routeContext.documentId);
        setActiveSourceId(routeContext.sourceId);
        setResolvedSourceName(routeContext.sourceName);
        return;
      }

      setIsLoadingFile(true);
      setLoadError(null);

      try {
        const [blobFile, fileRecord] = await Promise.all([
          resolvePdfFileBlob(routeContext.pdfFileId),
          pdfReaderRepository.getPdfFileById(routeContext.pdfFileId),
        ]);

        if (cancelled) return;

        if (!blobFile) {
          setActiveFile(null);
          setLoadError(
            "Não foi possível recuperar o binário do PDF. Reimporte o arquivo para abrir no Knexread.",
          );
          return;
        }

        setActiveFile(blobFile);
        const routeGuideId = fileRecord?.id ?? routeContext.pdfFileId;
        if (routeGuideId) {
          upsertPdfGuide({
            id: routeGuideId,
            kind: "pdf",
            title: routeContext.sourceName ?? fileRecord?.fileName ?? blobFile.name,
            file: blobFile,
            pdfFileId: fileRecord?.id ?? routeContext.pdfFileId,
            projectId: fileRecord?.projectId ?? routeContext.projectId ?? DEFAULT_PROJECT_ID,
            documentId: fileRecord?.documentId ?? routeContext.documentId,
            sourceId: fileRecord?.sourceId ?? routeContext.sourceId,
            sourceName: routeContext.sourceName ?? fileRecord?.fileName ?? blobFile.name,
          });
          setActiveGuideId(routeGuideId);
        }
        setActiveProjectId(fileRecord?.projectId ?? routeContext.projectId ?? DEFAULT_PROJECT_ID);
        setActiveDocumentId(fileRecord?.documentId ?? routeContext.documentId);
        setActiveSourceId(fileRecord?.sourceId ?? routeContext.sourceId);
        setResolvedSourceName(
          routeContext.sourceName ?? fileRecord?.fileName ?? blobFile.name,
        );
      } catch (error) {
        if (cancelled) return;
        setActiveFile(null);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Falha ao abrir PDF no Knexread.",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingFile(false);
        }
      }
    };

    void loadFromRoute();

    return () => {
      cancelled = true;
    };
  }, [routeContext.documentId, routeContext.launchId, routeContext.pdfFileId, routeContext.projectId, routeContext.sourceId, routeContext.sourceName, upsertPdfGuide]);

  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0] ?? null;
      if (!selected) return;
      openPdfGuideFromFile({
        file: selected,
        projectId: routeContext.projectId ?? DEFAULT_PROJECT_ID,
        documentId: routeContext.documentId,
        sourceId: routeContext.sourceId,
        sourceName: selected.name,
      });
      event.currentTarget.value = "";
    },
    [
      openPdfGuideFromFile,
      routeContext.documentId,
      routeContext.projectId,
      routeContext.sourceId,
    ],
  );

  const handleOpenRecent = useCallback(async (pdfFileId: string) => {
    setLoadError(null);
    setIsLoadingFile(true);
    try {
      const [blobFile, fileRecord] = await Promise.all([
        resolvePdfFileBlob(pdfFileId),
        pdfReaderRepository.getPdfFileById(pdfFileId),
      ]);

      if (!blobFile || !fileRecord) {
        setLoadError(
          "Nao foi possivel recuperar o arquivo recente. Reimporte o PDF para abrir no Knexread.",
        );
        return;
      }

      setActiveFile(blobFile);
      upsertPdfGuide({
        id: fileRecord.id,
        kind: "pdf",
        title: fileRecord.fileName ?? blobFile.name,
        file: blobFile,
        pdfFileId: fileRecord.id,
        projectId: fileRecord.projectId ?? routeContext.projectId ?? DEFAULT_PROJECT_ID,
        documentId: fileRecord.documentId ?? undefined,
        sourceId: fileRecord.sourceId ?? undefined,
        sourceName: fileRecord.fileName ?? blobFile.name,
      });
      setActiveGuideId(fileRecord.id);
      setActiveProjectId(fileRecord.projectId ?? routeContext.projectId ?? DEFAULT_PROJECT_ID);
      setActiveDocumentId(fileRecord.documentId ?? undefined);
      setActiveSourceId(fileRecord.sourceId ?? undefined);
      setResolvedSourceName(fileRecord.fileName ?? blobFile.name);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Falha ao abrir arquivo recente.",
      );
    } finally {
      setIsLoadingFile(false);
    }
  }, [routeContext.projectId, upsertPdfGuide]);

  const handleActivateGuide = useCallback(async (guideId: string) => {
    if (guideId === "home") {
      setActiveGuideId("home");
      setActiveFile(null);
      setIsLoadingFile(false);
      setLoadError(null);
      return;
    }

    const targetGuide = openGuides.find((guide) => guide.id === guideId);
    if (!targetGuide || targetGuide.kind !== "pdf") return;

    setActiveGuideId(targetGuide.id);
    setLoadError(null);

    if (targetGuide.file) {
      setActiveFile(targetGuide.file);
      setActiveProjectId(targetGuide.projectId);
      setActiveDocumentId(targetGuide.documentId);
      setActiveSourceId(targetGuide.sourceId);
      setResolvedSourceName(targetGuide.sourceName ?? targetGuide.file.name);
      return;
    }

    if (!targetGuide.pdfFileId) return;

    setIsLoadingFile(true);
    try {
      const [blobFile, fileRecord] = await Promise.all([
        resolvePdfFileBlob(targetGuide.pdfFileId),
        pdfReaderRepository.getPdfFileById(targetGuide.pdfFileId),
      ]);
      if (!blobFile || !fileRecord) {
        setLoadError("Nao foi possivel abrir a guia selecionada.");
        return;
      }
      const hydratedGuide: Extract<KnexreadOpenGuide, { kind: "pdf" }> = {
        ...targetGuide,
        file: blobFile,
        title: fileRecord.fileName ?? blobFile.name,
        projectId: fileRecord.projectId ?? targetGuide.projectId,
        documentId: fileRecord.documentId ?? targetGuide.documentId,
        sourceId: fileRecord.sourceId ?? targetGuide.sourceId,
        sourceName: fileRecord.fileName ?? blobFile.name,
      };
      upsertPdfGuide(hydratedGuide);
      setActiveFile(blobFile);
      setActiveProjectId(hydratedGuide.projectId);
      setActiveDocumentId(hydratedGuide.documentId);
      setActiveSourceId(hydratedGuide.sourceId);
      setResolvedSourceName(hydratedGuide.sourceName ?? blobFile.name);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Falha ao trocar de guia.");
    } finally {
      setIsLoadingFile(false);
    }
  }, [openGuides, upsertPdfGuide]);

  const handleCloseGuide = useCallback((guideId: string) => {
    if (guideId === "home") return;
    setOpenGuides((current) => current.filter((guide) => guide.id !== guideId));
    if (activeGuideId === guideId) {
      setActiveGuideId("home");
      setActiveFile(null);
      setLoadError(null);
    }
  }, [activeGuideId]);

  const guidesBar = !isLoadingFile ? (
    <div
      className="flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-zinc-300 bg-white px-0 pt-1"
      style={{ height: KNEXREAD_GUIDES_BAR_HEIGHT }}
    >
      {openGuides.map((guide) => {
        const isActive = guide.id === activeGuideId;
        const isHomeGuide = guide.id === "home";
        return (
          <div
            key={guide.id}
            className={`group relative flex h-8 items-center gap-1.5 border px-2 text-sm font-medium ${
              isActive
                ? "bg-white"
                : "border-zinc-300 bg-zinc-100 hover:bg-zinc-50 hover:text-[#c23616]"
            }`}
            style={{
              width: isHomeGuide ? 178 : 232,
              minWidth: isHomeGuide ? 140 : 150,
              maxWidth: isHomeGuide ? 178 : 232,
              flex: "1 1 auto",
              color: isActive ? "#c23616" : "#09090b",
              borderColor: isActive ? "#a1a1aa" : undefined,
              borderBottomWidth: isActive ? 0 : undefined,
              borderTopLeftRadius: 5,
              borderTopRightRadius: 5,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }}
          >
            <button
              type="button"
              onClick={() => {
                void handleActivateGuide(guide.id);
              }}
              className="min-w-0 flex-1 truncate text-left"
              style={{ color: "inherit" }}
              title={guide.title}
            >
              {guide.title}
            </button>
            {guide.kind === "pdf" ? (
              <button
                type="button"
                onClick={() => handleCloseGuide(guide.id)}
                className="inline-flex h-4 w-4 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                aria-label={`Fechar ${guide.title}`}
              >
                &times;
              </button>
            ) : null}
            {isActive ? (
              <span
                aria-hidden="true"
                className="absolute bottom-[2px] left-2 right-8 h-[3px] rounded-full"
                style={{ backgroundColor: "currentColor" }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <main className="knexread-page">
      <header className="knexread-titlebar">
        <div className="knexread-title-left">
          <button type="button" className="knexread-icon-btn" aria-label="Arquivo">
            <FolderOpen size={16} />
          </button>
          <button type="button" className="knexread-icon-btn" aria-label="Abrir PDF" onClick={handlePickFile}>
            <FileUp size={16} />
          </button>
          <span className="knexread-title-separator" />
          <div className="knexread-title-meta">
            <p className="knexread-title-app">Knexread</p>
          </div>
        </div>

        <div className="knexread-title-search">
          <Search size={16} />
          <input type="text" placeholder="Pesquisar" aria-label="Pesquisar no leitor" />
        </div>

        <div className="knexread-title-right">
          <button type="button" className="knexread-icon-btn" aria-label="Mais opções">
            <ChevronDown size={14} />
          </button>
          <button type="button" className="knexread-window-btn" aria-label="Minimizar">
            <Minus size={14} />
          </button>
          <button type="button" className="knexread-window-btn" aria-label="Maximizar">
            <Square size={12} />
          </button>
          <button type="button" className="knexread-window-btn danger" aria-label="Fechar leitor" onClick={() => router.push("/knexwriter/web")}>
            <X size={14} />
          </button>
        </div>
      </header>

      <section className="knexread-stage">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {isLoadingFile ? (
          <div className="knexread-empty-state">Carregando PDF salvo...</div>
        ) : null}


        {!isLoadingFile && (!activeFile || activeGuideId === "home") ? (
          <div className="flex h-full w-full flex-col overflow-hidden">
            <KnexreadTabs activeTab={landingTab} onTabChange={setLandingTab} />
            {landingTab !== "arquivo" ? (
              <KnexreadRibbon
                activeTab={landingTab}
                translationViewMode={landingViewMode}
                translationStrategy={landingStrategy}
                sourceLanguage={landingSourceLanguage}
                targetLanguage={landingTargetLanguage}
                showRuler={landingShowRuler}
                showMargins={landingShowMargins}
                showViewportCenter={landingShowViewportCenter}
                showPageCenter={landingShowPageCenter}
                showTextLayer={landingShowTextLayer}
                showOcrDebugBoxes={landingShowOcrDebugBoxes}
                hasSelection={false}
                onOpenPdf={handlePickFile}
                onClosePdf={() => router.push("/knexwriter/web")}
                onSaveSession={() => {}}
                onZoomIn={() => {}}
                onZoomOut={() => {}}
                onFitWidth={() => {}}
                onFitPage={() => {}}
                onActualSize={() => {}}
                onTranslateSelection={() => {}}
                onHighlightSelection={() => {}}
                onCommentSelection={() => {}}
                onCopySelection={() => {}}
                onCreateDirectCitation={() => {}}
                onCreateIndirectCitation={() => {}}
                onCreateReferenceFromSelection={() => {}}
                onTranslatePage={() => {}}
                onTranslateDocument={() => {}}
                onTranslationStrategyChange={setLandingStrategy}
                onSourceLanguageChange={setLandingSourceLanguage}
                onTargetLanguageChange={setLandingTargetLanguage}
                onTranslationViewModeChange={setLandingViewMode}
                onToggleRuler={() => setLandingShowRuler((value) => !value)}
                onToggleMargins={() => setLandingShowMargins((value) => !value)}
                onToggleViewportCenter={() => setLandingShowViewportCenter((value) => !value)}
                onTogglePageCenter={() => setLandingShowPageCenter((value) => !value)}
                onToggleTextLayer={() => setLandingShowTextLayer((value) => !value)}
                onToggleOcrDebugBoxes={() => setLandingShowOcrDebugBoxes((value) => !value)}
                onRunPageOcr={() => {}}
                onRunDocumentOcr={() => {}}
                onNextReviewBlock={() => {}}
                onPreviousReviewBlock={() => {}}
                onMarkFocusedAsReviewed={() => {}}
                onRebuildFocusedBlock={() => {}}
                onExportTranslated={() => {}}
                onExportBilingual={() => {}}
                onExportWithAnnotations={() => {}}
              />
            ) : null}
            {landingTab !== "arquivo" ? guidesBar : null}
            {landingTab === "arquivo" ? (
              <PdfFileBackstage
                sourceName={resolvedSourceName ?? "Knexread"}
                currentPdfFileId={routeContext.pdfFileId}
                recentFiles={recentFiles}
                activeSection={landingFileSection}
                onSectionChange={setLandingFileSection}
                onOpenComputer={handlePickFile}
                onOpenRecent={(pdfFileId) => {
                  void handleOpenRecent(pdfFileId);
                }}
                onCloseReader={() => router.push("/knexwriter/web")}
              />
            ) : (
              <PdfHomePage
                currentPdfFileId={routeContext.pdfFileId}
                recentFiles={recentFiles}
                onOpenComputer={handlePickFile}
                onOpenRecent={(pdfFileId) => {
                  void handleOpenRecent(pdfFileId);
                }}
              />
            )}
            {loadError ? (
              <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow">
                {loadError}
              </div>
            ) : null}
          </div>
        ) : null}

        {!isLoadingFile && activeFile && activeGuideId !== "home" ? (
          <KnexreadShell
            key={activeGuideId}
            file={activeFile}
            projectId={activeProjectId}
            documentId={activeDocumentId}
            sourceId={activeSourceId}
            sourceName={resolvedSourceName}
            presentation="page"
            showShellHeader={false}
            guidesBar={guidesBar}
            onOpenPdfInNewGuide={openPdfGuideFromFile}
            onClose={() => router.push("/knexwriter/web")}
          />
        ) : null}
      </section>
    </main>
  );
}
