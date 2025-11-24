"use client";

import { useMemo } from "react";
import DocumentSourceSelector from "./DocumentSourceSelector";
import DocumentSidebar from "./DocumentSidebar";
import ReaderToolbar from "./ReaderToolbar";
import SinglePaneViewer from "./SinglePaneViewer";
import DualPaneViewer from "./DualPaneViewer";
import SelectionActionsPanel from "./SelectionActionsPanel";
import type { DocumentDescriptor, VioReadDocument } from "../lib/vioreadTypes";

type ViewerData = {
  original: VioReadDocument | null;
  translated: VioReadDocument | null;
};

type Props = {
  mode: "single" | "dual";
  onModeChange: (m: "single" | "dual") => void;
  sourceLang: string;
  targetLang: string;
  onSourceLangChange: (lang: string) => void;
  onTargetLangChange: (lang: string) => void;
  onSelectDocument: (descriptor: DocumentDescriptor) => void;
  viewerData: ViewerData;
  translating: boolean;
  translateError: string | null;
  activeSectionId: string | null;
  onActiveSectionChange: (id: string | null) => void;
};

export default function ReaderShell({
  mode,
  onModeChange,
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSelectDocument,
  viewerData,
  translating,
  translateError,
  activeSectionId,
  onActiveSectionChange,
}: Props) {
  const sidebarSections = useMemo(() => viewerData.translated?.sections || viewerData.original?.sections || [], [viewerData]);

  return (
    <div className="min-h-screen grid grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-r border-slate-200 bg-slate-50/50">
        <div className="p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">VioRead</h2>
          <DocumentSourceSelector onDocumentSelected={onSelectDocument} />
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Seções</h3>
            <DocumentSidebar sections={sidebarSections} activeSectionId={activeSectionId} onSelectSection={onActiveSectionChange} />
          </div>
        </div>
      </aside>

      <main className="min-h-screen bg-white">
        <div className="border-b border-slate-200">
          <ReaderToolbar
            mode={mode}
            onModeChange={onModeChange}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSourceLangChange={onSourceLangChange}
            onTargetLangChange={onTargetLangChange}
            translating={translating}
            translateError={translateError}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-6">
            {mode === "dual" ? (
              <DualPaneViewer original={viewerData.original} translated={viewerData.translated} />
            ) : (
              <SinglePaneViewer document={viewerData.translated || viewerData.original} />
            )}
          </div>
          <div className="border-l border-slate-200 bg-slate-50/50 p-4">
            <SelectionActionsPanel />
          </div>
        </div>
      </main>
    </div>
  );
}

