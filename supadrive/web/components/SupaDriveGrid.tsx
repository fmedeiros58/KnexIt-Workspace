"use client";

import { useEffect, useMemo, useRef, useState, type JSX } from "react";

export type SupaDriveKind =
  | "folder"
  | "doc"
  | "sheet"
  | "slides"
  | "vids"
  | "forms"
  | "pdf"
  | "link"
  | "image";

export type SupaDriveItem = {
  id: string;
  name: string;
  meta: string;
  badge?: string;
  kind: SupaDriveKind;
  filePath?: string | null;
  fileUrl?: string | null;
  thumbnailPath?: string | null;
  thumbnailUrl?: string | null;
};

type SupaDriveGridProps = {
  items: SupaDriveItem[];
  onOpen?: (item: SupaDriveItem) => void;
  onRename?: (item: SupaDriveItem) => void;
  onMoveToTrash?: (item: SupaDriveItem) => void;
  onDeletePermanently?: (item: SupaDriveItem) => void;
  onDetails?: (item: SupaDriveItem) => void;
};

type MenuAction = "open" | "details" | "rename" | "move_to_trash" | "delete_permanently";

/** ✅ Drive-like: coluna fixa */
const FIXED_COL_W = 248;

const kindConfig: Record<string, { icon: JSX.Element; color: string; label: string; previewMode: "paper" | "cover" }> = {
  folder: {
    label: "Pasta",
    color: "text-amber-600",
    previewMode: "paper",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M3 6h6l2 2h10v10H3z" />
      </svg>
    ),
  },
  doc: {
    label: "Documento",
    color: "text-blue-600",
    previewMode: "paper",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M7 3h7l5 5v13H7z" opacity={0.25} />
        <path d="M14 3v5h5" />
      </svg>
    ),
  },
  sheet: {
    label: "Planilha",
    color: "text-green-600",
    previewMode: "paper",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <rect x="5" y="3" width="14" height="18" rx="1.5" opacity={0.25} />
        <path d="M8 8h8M8 12h8M8 16h8" stroke="white" strokeWidth={1.3} />
      </svg>
    ),
  },
  slides: {
    label: "Apresentação",
    color: "text-amber-600",
    previewMode: "paper",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <rect x="5" y="5" width="14" height="14" rx="2" opacity={0.25} />
        <rect x="8" y="8" width="8" height="8" rx="1" stroke="white" strokeWidth={1.2} fill="none" />
      </svg>
    ),
  },
  vids: {
    label: "Vídeo",
    color: "text-purple-600",
    previewMode: "paper",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <rect x="5" y="6" width="14" height="12" rx="2" opacity={0.25} />
        <path d="M11 9v6l4-3z" fill="white" />
      </svg>
    ),
  },
  forms: {
    label: "Formulário",
    color: "text-pink-600",
    previewMode: "paper",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <rect x="7" y="3" width="10" height="18" rx="2" opacity={0.25} />
        <path d="M10 8h4M10 12h4M10 16h2" stroke="white" strokeWidth={1.3} />
      </svg>
    ),
  },
  pdf: {
    label: "PDF",
    color: "text-rose-600",
    previewMode: "paper",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M6 4h9l5 5v11H6z" opacity={0.25} />
        <path d="M14 4v5h5" />
      </svg>
    ),
  },
  image: {
    label: "Imagem",
    color: "text-sky-600",
    previewMode: "cover",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" />
        <path d="M8 13l2-2 3 3 2-2 3 3" />
        <path d="M9 9h.01" />
      </svg>
    ),
  },
  link: {
    label: "Link",
    color: "text-slate-600",
    previewMode: "paper",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M10 13a5 5 0 0 0 7.54.54l1.92-1.92a3 3 0 0 0-4.24-4.24l-1 1" />
        <path d="M14 11a5 5 0 0 0-7.54-.54L4.54 12.4a3 3 0 0 0 4.24 4.24l1-1" />
      </svg>
    ),
  },
};

const fallbackIcon = {
  label: "Item",
  color: "text-slate-600",
  previewMode: "paper" as const,
  icon: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
};

function getPreview(kind: string) {
  const palette: Record<string, string> = {
    doc: "from-blue-50 via-white to-blue-100",
    sheet: "from-green-50 via-white to-green-100",
    slides: "from-amber-50 via-white to-amber-100",
    vids: "from-purple-50 via-white to-purple-100",
    forms: "from-pink-50 via-white to-pink-100",
    folder: "from-slate-50 via-white to-slate-100",
    pdf: "from-rose-50 via-white to-rose-100",
    link: "from-slate-50 via-white to-slate-100",
    image: "from-slate-50 via-white to-slate-100",
  };
  return palette[kind] ?? "from-slate-50 via-white to-slate-100";
}

function useOutsideClick(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

function MenuItem({
  label,
  danger,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
        danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="flex-1">{label}</span>
    </button>
  );
}

export function SupaDriveGrid({
  items,
  onOpen,
  onRename,
  onMoveToTrash,
  onDeletePermanently,
  onDetails,
}: SupaDriveGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuRef, () => setOpenMenuFor(null));

  const selectedCount = selectedIds.size;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSelected = (id: string) => selectedIds.has(id);

  const gridTemplateColumns = useMemo(() => `repeat(auto-fill, ${FIXED_COL_W}px)`, []);

  const handleAction = (action: MenuAction, item: SupaDriveItem) => {
    setOpenMenuFor(null);

    if (action === "open") return onOpen?.(item);
    if (action === "details") return onDetails?.(item);
    if (action === "rename") return onRename?.(item);
    if (action === "move_to_trash") return onMoveToTrash?.(item);
    if (action === "delete_permanently") return onDeletePermanently?.(item);
  };

  if (!items.length) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/70 text-center text-sm text-slate-500">
        <p>Sem pastas ou arquivos para exibir.</p>
        <p className="text-xs text-slate-400">Use o menu “Novo” para adicionar conteúdo.</p>
      </section>
    );
  }

  return (
    <div className="relative h-full">
      {selectedCount > 0 ? (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <span>{selectedCount} selecionado(s)</span>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpar
          </button>
        </div>
      ) : null}

      <div
        className="grid flex-1 min-h-0 gap-4 overflow-y-auto overflow-x-hidden rounded-3xl border border-slate-100 bg-white/80 p-4"
        style={{
          gridTemplateColumns,
          gridAutoFlow: "row",
          justifyContent: "start", // ✅ NÃO estica as colunas
          alignContent: "start",
        }}
      >
        {items.map((item) => {
          const config = kindConfig[item.kind] ?? fallbackIcon;
          const selected = isSelected(item.id);
          const menuOpen = openMenuFor === item.id;

          // ✅ fallback para imagem: se não tiver thumb, usa o próprio fileUrl
          const effectiveThumb =
            item.thumbnailUrl ||
            (item.kind === "image" ? item.fileUrl : undefined);

          const thumbFit =
            config.previewMode === "cover" ? "object-cover" : "object-contain";

          return (
            <div key={item.id} className="relative" style={{ width: FIXED_COL_W }}>
              <article
                className={[
                  "group overflow-hidden rounded-2xl border bg-white transition",
                  selected
                    ? "border-blue-300 ring-2 ring-blue-200"
                    : "border-slate-200 hover:border-blue-200 hover:ring-2 hover:ring-blue-100",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => (selectedCount ? toggleSelected(item.id) : onOpen?.(item))}
                  className="block w-full text-left"
                  aria-label={`Abrir ${item.name}`}
                >
                  {/* PREVIEW proporcional estilo Drive */}
                  <div className="relative w-full bg-slate-50">
                    <div className="aspect-[16/10] w-full p-2.5">
                      <div className="h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        {effectiveThumb ? (
                          <img
                            src={effectiveThumb}
                            alt={item.name}
                            className={`h-full w-full ${thumbFit}`}
                            loading="lazy"
                            draggable={false}
                          />
                        ) : (
                          <div className={`flex h-full w-full items-start justify-between bg-gradient-to-br ${getPreview(item.kind)} p-3`}>
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 ${config.color}`}>
                              {config.icon}
                            </span>
                            <span className="text-[11px] text-slate-500">{config.label}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* checkbox hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelected(item.id);
                      }}
                      className="absolute left-2 top-2 opacity-0 transition group-hover:opacity-100"
                      aria-label={selected ? "Desmarcar" : "Selecionar"}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm ${
                          selected ? "border-blue-400 text-blue-600" : "border-slate-200 text-slate-400"
                        }`}
                      >
                        {selected ? "✓" : ""}
                      </span>
                    </button>

                    {item.badge ? (
                      <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        {item.badge}
                      </span>
                    ) : null}

                    {/* ⋮ hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuFor((curr) => (curr === item.id ? null : item.id));
                      }}
                      className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100"
                      aria-label="Mais ações"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-600 hover:bg-white">
                        ⋮
                      </span>
                    </button>
                  </div>
                </button>

                {/* linha inferior */}
                <div className="flex items-start gap-2 px-3 py-2">
                  <span className={`${config.color} mt-0.5 shrink-0`}>{config.icon}</span>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{item.name}</div>
                    <div className="truncate text-xs text-slate-500">{item.meta}</div>
                  </div>
                </div>
              </article>

              {/* menu */}
              {menuOpen ? (
                <div
                  ref={menuRef}
                  className="absolute right-2 top-10 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  <MenuItem label="Abrir" onClick={() => handleAction("open", item)} />
                  <MenuItem label="Detalhes" onClick={() => handleAction("details", item)} />
                  <div className="my-1 h-px bg-slate-100" />
                  <MenuItem label="Renomear" onClick={() => handleAction("rename", item)} />
                  <MenuItem label="Mover para lixeira" onClick={() => handleAction("move_to_trash", item)} />
                  <MenuItem danger label="Remover permanentemente" onClick={() => handleAction("delete_permanently", item)} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
