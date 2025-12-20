"use client";

import { useRef, useState, type ChangeEvent } from "react";

import {
  SupaDriveFilters,
  SupaDriveToolbar,
  InfoPanel,
  SupaDriveAppsRail,
  SidebarNav,
  TopBar,
  SupaDriveGrid,
} from "./components";
import type { SupaDriveItem, SupaDriveKind } from "./components";
import { getThumbUrl } from "./lib/storage";
import {
  getPublicUrl as getStoragePublicUrl,
  getSignedUrl as getStorageSignedUrl,
} from "./lib/storageUrls";

type ChipFilter = { id: string; label: string; baseLabel?: string; selectedLabel?: string };
type InfoTab = { id: string; label: string; active?: boolean };

const TOPBAR_OFFSET = 72;

const initialFilters: ChipFilter[] = [
  { id: "type", label: "Tipo", baseLabel: "Tipo" },
  { id: "people", label: "Pessoas", baseLabel: "Pessoas" },
  { id: "modified", label: "Modificado", baseLabel: "Modificado" },
  { id: "source", label: "Fonte", baseLabel: "Fonte" },
  { id: "cleanup", label: "Limpar filtros", baseLabel: "Limpar filtros" },
];

const infoTabs: InfoTab[] = [
  { id: "details", label: "Detalhes", active: true },
  { id: "activity", label: "Atividades" },
];

const iconPath = (name: string) => {
  const paths: Record<string, string> = {
    personal:
      "M12 4a4 4 0 1 1-4 4 4 4 0 0 1 4-4Zm0 7c-3.866 0-7 1.79-7 4v1h14v-1c0-2.21-3.134-4-7-4Z",
    supadrive: "M4 6h7l2 2h7v11H4ZM4 6V4h7l2 2h7M6 12h12M6 16h12",
    shared: "M7 7a3 3 0 1 1 3 3 3 3 0 0 1-3-3Zm7-1h6v12H7v-3h8Z",
    computers: "M4 5h16v10H4Zm4 12h8",
    recent: "M12 6v6l4 2M5 12a7 7 0 1 1 7 7",
    starred:
      "m12 5 1.9 3.86L18 9.62l-3 2.92.71 4.14L12 15.77l-3.71 1.91L9 12.54 6 9.62l4.1-.76Z",
    spam: "M12 3.1 4.1 11l7.9 7.9L19.9 11Zm0 4v4m0 4h.01",
    trash: "M5 7h14M10 11v6m4-6v6M7 7l1-2h8l1 2M9 7v-2h6v2",
  };
  return paths[name] ?? "M5 5h14v14H5Z";
};

const primaryNav = [
  { id: "personal", label: "Pessoal", icon: iconPath("personal") },
  { id: "supadrive", label: "Meu SupaDrive", icon: iconPath("supadrive"), active: true },
  { id: "shared", label: "Drives compartilhados", icon: iconPath("shared") },
  { id: "computers", label: "Computadores", icon: iconPath("computers") },
];

const secondaryNav = [
  { id: "shared", label: "Compartilhados comigo", icon: iconPath("shared") },
  { id: "recent", label: "Recentes", icon: iconPath("recent") },
  { id: "starred", label: "Com estrela", icon: iconPath("starred") },
  { id: "spam", label: "Spam", icon: iconPath("spam") },
  { id: "trash", label: "Lixeira", icon: iconPath("trash") },
];

const THUMBS_BUCKET = "thumbs";
const FILES_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_FILES_BUCKET ?? "files";
const isFilesBucketPrivate = process.env.NEXT_PUBLIC_SUPABASE_FILES_PRIVATE === "true";

async function resolveFileUrl(path?: string | null) {
  if (!path) return null;
  if (isFilesBucketPrivate) return getStorageSignedUrl(FILES_BUCKET, path, 60 * 60);
  return getStoragePublicUrl(FILES_BUCKET, path);
}

export default function SupaDrivePage() {
  const [appsRailOpen, setAppsRailOpen] = useState(true);
  const [infoPanelVisible, setInfoPanelVisible] = useState(true);
  const [chipFilters, setChipFilters] = useState<ChipFilter[]>(initialFilters);
  const [driveItems, setDriveItems] = useState<SupaDriveItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [focusedItem, setFocusedItem] = useState<SupaDriveItem | null>(null);
  const railCollapsed = !appsRailOpen && !infoPanelVisible;

  const handleToggleFilter = (id: string) => {
    if (id !== "cleanup") return;

    setChipFilters((prev) =>
      prev.map((chip) => ({
        ...chip,
        selectedLabel: undefined,
      }))
    );
  };

  const handleSelectFilterOption = (id: string, selected: string) => {
    setChipFilters((prev) =>
      prev.map((chip) =>
        chip.id === id
          ? { ...chip, selectedLabel: selected }
          : chip
      )
    );
  };

  const handleClearFilter = (id: string) => {
    setChipFilters((prev) =>
      prev.map((chip) =>
        chip.id === id ? { ...chip, selectedLabel: undefined } : chip
      )
    );
  };

  const handleOpenItem = (item: SupaDriveItem) => {
    setFocusedItem(item);
    setInfoPanelVisible(true);
  };

  const handleDetails = (item: SupaDriveItem) => {
    setFocusedItem(item);
    setInfoPanelVisible(true);
  };

  const handleRename = (item: SupaDriveItem) => {
    const nextName = window.prompt("Renomear item", item.name)?.trim();
    if (!nextName) return;
    setDriveItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, name: nextName } : it)));
    setFocusedItem((prev) => (prev?.id === item.id ? { ...item, name: nextName } : prev));
  };

  const handleMoveToTrash = (item: SupaDriveItem) => {
    setDriveItems((prev) => prev.filter((it) => it.id !== item.id));
    setFocusedItem((prev) => (prev?.id === item.id ? null : prev));
  };

  const handleDeletePermanently = (item: SupaDriveItem) => {
    setDriveItems((prev) => prev.filter((it) => it.id !== item.id));
    setFocusedItem((prev) => (prev?.id === item.id ? null : prev));
  };

  const handleCreateItem = async (type: string) => {
    if (type === "file") {
      fileInputRef.current?.click();
      return;
    }

    const presets: Record<string, { label: string; kind: SupaDriveKind; badge?: string }> = {
      folder: { label: "Nova pasta", kind: "folder" },
      "folder-upload": { label: "Pasta importada", kind: "folder" },
      docs: { label: "Documento sem titulo", kind: "doc" },
      sheets: { label: "Planilha sem titulo", kind: "sheet" },
      slides: { label: "Apresentacao sem titulo", kind: "slides" },
      vids: { label: "Projeto de video", kind: "vids" },
      forms: { label: "Formulario sem titulo", kind: "forms" },
      more: { label: "Atalho rapido", kind: "link" },
    };

    const preset = presets[type] ?? { label: "Arquivo", kind: "doc" as SupaDriveKind };
    const duplicateIndex = driveItems.filter((item) => item.name.startsWith(preset.label)).length + 1;

    const name = `${preset.label} ${duplicateIndex}`;
    const meta = `Atualizado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const id = `${type}-${Date.now()}`;
    let thumbnailPath: string | undefined;
    let thumbnailUrl: string | null | undefined;

    const filePath = preset.kind === "folder" ? undefined : `${id}`;
    const fileUrl = filePath ? await resolveFileUrl(filePath) : null;

    if (preset.kind !== "folder") {
      thumbnailPath = `${THUMBS_BUCKET}/${id}.webp`;
      thumbnailUrl = await getThumbUrl(THUMBS_BUCKET, thumbnailPath);
    }

    const newItem: SupaDriveItem = {
      id,
      name,
      meta,
      kind: preset.kind,
      badge: preset.badge,
      filePath,
      fileUrl,
      thumbnailPath,
      thumbnailUrl: thumbnailUrl ?? null,
    };

    setDriveItems((prev) => [...prev, newItem]);
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const normalizeKind = (fileName: string): SupaDriveKind => {
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif"].includes(ext)) return "image";
      if (["doc", "docx", "txt", "rtf", "md"].includes(ext)) return "doc";
      if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
      if (["ppt", "pptx", "key"].includes(ext)) return "slides";
      if (["mp4", "mov", "mkv", "avi"].includes(ext)) return "vids";
      if (["pdf"].includes(ext)) return "pdf";
      if (["form"].includes(ext)) return "forms";
      return "link";
    };

    const baseTimestamp = Date.now();
    const uploadedItems: SupaDriveItem[] = await Promise.all(
      files.map(async (file, index) => {
        const kind = normalizeKind(file.name);
        const id = `upload-${baseTimestamp}-${index}`;
        const meta = `Enviado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;

        let thumbnailPath: string | undefined;
        let thumbnailUrl: string | null | undefined;

        const filePath = `${id}/${file.name}`;
        let fileUrl = await resolveFileUrl(filePath);

        if (kind !== "folder") {
          thumbnailPath = `${THUMBS_BUCKET}/${id}.webp`;
          thumbnailUrl = await getThumbUrl(THUMBS_BUCKET, thumbnailPath);
        }

        if (kind === "image") {
          fileUrl = fileUrl ?? URL.createObjectURL(file);
          thumbnailUrl = thumbnailUrl ?? fileUrl;
        }

        return {
          id,
          name: file.name,
          meta,
          kind,
          filePath,
          fileUrl: fileUrl ?? null,
          thumbnailPath,
          thumbnailUrl: thumbnailUrl ?? null,
        };
      })
    );

    setDriveItems((prev) => [...prev, ...uploadedItems]);
    event.target.value = "";
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <div className="flex w-full flex-col gap-0 px-0 pb-0 pt-0">
        <div className="bg-transparent p-0" data-section="header-container">
          <TopBar workspaceName="SupaDrive" userInitials="FM" />
        </div>

        <div
          className="flex gap-3 pb-0 items-stretch min-h-0 overflow-y-hidden overflow-x-visible"
          data-section="layout-shell"
          style={{ height: `calc(100vh - ${TOPBAR_OFFSET}px)` }}
        >
          <div className="h-full mb-4">
            <SidebarNav
              primary={primaryNav}
              secondary={secondaryNav}
              storagePercent={84}
              storageUsed="84,88 GB"
              storageTotal="100 GB"
              onCreateItem={handleCreateItem}
            />
          </div>

          <div className="flex flex-1 h-full min-h-0 flex-col gap-2" style={railCollapsed ? { flexBasis: "100%" } : undefined}>
            <div className="mb-4 flex h-full min-h-0 flex-col gap-6 rounded-3xl bg-white p-3 shadow-sm" style={{ minWidth: "560px" }}>
              <SupaDriveToolbar
                title="Meu SupaDrive"
                onToggleInfo={() => setInfoPanelVisible((open) => !open)}
                infoPanelVisible={infoPanelVisible}
              >
                <SupaDriveFilters
                  chips={chipFilters}
                  onToggle={handleToggleFilter}
                  onSelectOption={handleSelectFilterOption}
                  onClear={handleClearFilter}
                />
              </SupaDriveToolbar>

              <div className="flex-1 min-h-0 overflow-y-auto">
                <SupaDriveGrid
                  items={driveItems}
                  onOpen={handleOpenItem}
                  onDetails={handleDetails}
                  onRename={handleRename}
                  onMoveToTrash={handleMoveToTrash}
                  onDeletePermanently={handleDeletePermanently}
                />
              </div>
            </div>
          </div>

          <aside
            className="relative flex h-full items-stretch"
            style={{
              gap: infoPanelVisible && appsRailOpen ? "0.125rem" : appsRailOpen ? "0.4rem" : "0rem",
              width: railCollapsed ? 0 : undefined,
            }}
          >
            {infoPanelVisible ? (
              <div className="mb-4 flex-1 max-h-[calc(100%-16px)] rounded-3xl bg-white shadow-sm overflow-hidden">
                <InfoPanel
                  title={focusedItem?.name ?? "Meu SupaDrive"}
                  tabs={infoTabs}
                  emptyTitle={focusedItem?.name ?? "Selecione um item"}
                  emptyMessage={focusedItem?.meta ?? "Escolha uma pasta ou arquivo para ver os detalhes aqui."}
                />
              </div>
            ) : null}

            <div
              className="flex h-full flex-none flex-col items-center justify-between rounded-3xl transition-all duration-200"
              style={{
                width: appsRailOpen ? 72 : 40,
                padding: appsRailOpen ? "0.75rem" : "0.2rem",
                marginLeft: appsRailOpen ? 0 : -24,
                position: railCollapsed ? "absolute" : "relative",
                right: railCollapsed ? "-12px" : undefined,
                top: railCollapsed ? "50%" : undefined,
                transform: railCollapsed ? "translateY(-50%)" : undefined,
              }}
            >
              <div className="flex-1">{appsRailOpen ? <SupaDriveAppsRail /> : null}</div>

              <div className="mt-6 flex flex-col items-center gap-2" id="apps-rail-toggle">
                <div className="h-10 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => setAppsRailOpen((open) => !open)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg shadow transition ${
                    appsRailOpen ? "border-slate-200 bg-white text-slate-500" : "border-slate-900 bg-slate-900 text-white"
                  }`}
                  aria-label={appsRailOpen ? "Recolher apps" : "Mostrar apps"}
                >
                  {appsRailOpen ? ">" : "<"}
                </button>
              </div>
            </div>
          </aside>
        </div>

        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileUpload} />
      </div>
    </main>
  );
}
