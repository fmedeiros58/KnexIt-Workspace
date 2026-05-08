"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Eraser,
  ListChecks,
  Paintbrush,
  Plus,
} from "lucide-react";
import { WriterRibbonGroup } from "../../WriterRibbonGroup";

type WriterStyleId =
  | "normal"
  | "no-spacing"
  | "title"
  | "subtitle"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "quote"
  | "intense-quote"
  | "emphasis"
  | "strong"
  | "caption"
  | "bibliography"
  | "footnote"
  | "code";

type WriterStyleOption = {
  id: WriterStyleId;
  label: string;
  previewLabel: string;
  description: string;
  category: "Básicos" | "Títulos" | "Acadêmicos" | "Ênfase" | "Técnicos";
  previewClassName: string;
  previewStyle?: React.CSSProperties;
};

type WriterStyleCommands = {
  applyStyle: (styleId: WriterStyleId) => void;
  clearStyle: () => void;
  createStyleFromSelection: () => void;
  openStylesPane: () => void;
  openStyleInspector: () => void;
};

type StylesGroupProps = {
  commands?: Partial<WriterStyleCommands>;
  disabled?: boolean;
  activeStyleId?: WriterStyleId;

  /**
   * Permite receber props extras vindas do HomeRibbonTab sem quebrar
   * a tipagem durante a evolução modular do KnexWriter.
   */
  [key: string]: unknown;
};

type FloatingMenuPosition = {
  top: number;
  left: number;
  minWidth: number;
};

type DropdownRenderProps = {
  close: () => void;
};

// =====================================================
// 1. CONFIGURACAO VISUAL DO GRUPO
// =====================================================

const STYLES_GROUP_LAYOUT = {
  minWidth: 566,
  containerPaddingX: 4,
  containerPaddingBottom: 12,
  galleryHeight: 60,
  galleryTileHeight: 58,
  galleryTileMinWidth: 96,
  dropdownButtonWidth: 24,
  launcherSize: 16,
  launcherFontSize: 12,
  menuViewportGap: 6,
  menuViewportPadding: 8,
  menuZIndex: 120000,
} as const;

const STYLES_GROUP_COLORS = {
  activeBorder: "#93c5fd",
  activeBackground: "#eff6ff",
  activeText: "#1e40af",
  menuBorder: "#d4d4d8",
} as const;

const STYLES_GROUP_MENU_LAYOUT = {
  galleryMenuWidth: 430,
  menuMaxHeight: "min(78vh,620px)",
} as const;

const WRITER_STYLES: WriterStyleOption[] = [
  {
    id: "normal",
    label: "Normal",
    previewLabel: "Normal",
    description: "Texto comum do corpo do documento.",
    category: "Básicos",
    previewClassName: "text-[16px] font-normal text-black",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "no-spacing",
    label: "Sem Espaçamento",
    previewLabel: "Sem Espaçar",
    description: "Texto comum sem espaçamento adicional entre parágrafos.",
    category: "Básicos",
    previewClassName: "text-[16px] font-normal text-black",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "heading-1",
    label: "Título 1",
    previewLabel: "Título 1",
    description: "Título principal de seção.",
    category: "Títulos",
    previewClassName: "text-[22px] font-bold text-[#1f4e79]",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "heading-2",
    label: "Título 2",
    previewLabel: "Título 2",
    description: "Subtítulo de segundo nível.",
    category: "Títulos",
    previewClassName: "text-[18px] font-bold text-[#1f4e79]",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "heading-3",
    label: "Título 3",
    previewLabel: "Título 3",
    description: "Subtítulo de terceiro nível.",
    category: "Títulos",
    previewClassName: "text-[16px] font-semibold text-[#1f2937]",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "title",
    label: "Título",
    previewLabel: "Título",
    description: "Título geral do documento.",
    category: "Títulos",
    previewClassName: "text-[24px] font-bold text-[#1f2937]",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "subtitle",
    label: "Subtítulo",
    previewLabel: "Subtítulo",
    description: "Subtítulo geral do documento.",
    category: "Títulos",
    previewClassName: "text-[17px] font-normal text-[#64748b]",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "quote",
    label: "Citação",
    previewLabel: "Citação",
    description: "Citação destacada com recuo e tom discreto.",
    category: "Acadêmicos",
    previewClassName: "text-[15px] italic text-[#374151]",
    previewStyle: {
      fontFamily: "Tinos, 'Times New Roman', serif",
    },
  },
  {
    id: "intense-quote",
    label: "Citação intensa",
    previewLabel: "Citação Intensa",
    description: "Citação com maior destaque visual.",
    category: "Acadêmicos",
    previewClassName: "text-[15px] font-semibold italic text-[#1f4e79]",
    previewStyle: {
      fontFamily: "Tinos, 'Times New Roman', serif",
    },
  },
  {
    id: "bibliography",
    label: "Referência",
    previewLabel: "Referência",
    description: "Estilo base para referências bibliográficas.",
    category: "Acadêmicos",
    previewClassName: "text-[14px] font-normal text-black",
    previewStyle: {
      fontFamily: "Tinos, 'Times New Roman', serif",
    },
  },
  {
    id: "footnote",
    label: "Nota de rodapé",
    previewLabel: "Nota",
    description: "Texto menor para notas e observações.",
    category: "Acadêmicos",
    previewClassName: "text-[12px] font-normal text-[#374151]",
    previewStyle: {
      fontFamily: "Tinos, 'Times New Roman', serif",
    },
  },
  {
    id: "emphasis",
    label: "Ênfase",
    previewLabel: "Ênfase",
    description: "Ênfase simples em itálico.",
    category: "Ênfase",
    previewClassName: "text-[15px] italic text-black",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "strong",
    label: "Forte",
    previewLabel: "Forte",
    description: "Ênfase forte em negrito.",
    category: "Ênfase",
    previewClassName: "text-[15px] font-bold text-black",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "caption",
    label: "Legenda",
    previewLabel: "Legenda",
    description: "Legenda para figuras, quadros e tabelas.",
    category: "Acadêmicos",
    previewClassName: "text-[13px] font-normal text-[#374151]",
    previewStyle: {
      fontFamily: "Arimo, Arial, sans-serif",
    },
  },
  {
    id: "code",
    label: "Código",
    previewLabel: "Código",
    description: "Trechos técnicos em fonte monoespaçada.",
    category: "Técnicos",
    previewClassName: "text-[13px] font-normal text-[#111827]",
    previewStyle: {
      fontFamily: "'Fira Code', Consolas, monospace",
    },
  },
];

const VISIBLE_STYLE_IDS: WriterStyleId[] = [
  "normal",
  "no-spacing",
  "heading-1",
  "heading-2",
  "heading-3",
];

export function StylesGroup({
  commands,
  disabled = false,
  activeStyleId = "normal",
}: StylesGroupProps = {}) {
  const [selectedStyleId, setSelectedStyleId] =
    useState<WriterStyleId>(activeStyleId);

  useEffect(() => {
    setSelectedStyleId(activeStyleId);
  }, [activeStyleId]);

  const visibleStyles = useMemo(() => {
    return VISIBLE_STYLE_IDS.map((id) => getStyleOption(id));
  }, []);

  const selectedStyle = getStyleOption(selectedStyleId);

  const applyStyle = (styleId: WriterStyleId) => {
    setSelectedStyleId(styleId);
    commands?.applyStyle?.(styleId);
  };

  const clearStyle = () => {
    setSelectedStyleId("normal");
    commands?.clearStyle?.();
  };

  return (
    <WriterRibbonGroup title="Estilos">
      <div
        className="relative flex items-start"
        style={{
          minWidth: STYLES_GROUP_LAYOUT.minWidth,
          paddingLeft: STYLES_GROUP_LAYOUT.containerPaddingX,
          paddingRight: STYLES_GROUP_LAYOUT.containerPaddingX,
          paddingBottom: STYLES_GROUP_LAYOUT.containerPaddingBottom,
        }}
      >
        <div
          className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-sm border border-zinc-300 bg-white"
          style={{ height: STYLES_GROUP_LAYOUT.galleryHeight }}
        >
          <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
            {visibleStyles.map((style) => (
              <StyleGalleryTile
                key={style.id}
                styleOption={style}
                active={selectedStyleId === style.id}
                disabled={disabled}
                onClick={() => applyStyle(style.id)}
              />
            ))}
          </div>

          <StyleGalleryDropdown
            disabled={disabled}
            selectedStyleId={selectedStyleId}
            selectedStyle={selectedStyle}
            onSelect={applyStyle}
            onClear={clearStyle}
            onCreateStyle={() => commands?.createStyleFromSelection?.()}
            onOpenInspector={() => commands?.openStyleInspector?.()}
          />
        </div>

        <button
          type="button"
          aria-label="Abrir painel de estilos"
          title="Abrir painel de estilos"
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-sm text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
          style={{
            width: STYLES_GROUP_LAYOUT.launcherSize,
            height: STYLES_GROUP_LAYOUT.launcherSize,
          }}
          onClick={(event) => {
            event.stopPropagation();
            commands?.openStylesPane?.();
          }}
        >
          <span
            className="leading-none"
            style={{ fontSize: STYLES_GROUP_LAYOUT.launcherFontSize }}
          >
            ↘
          </span>
        </button>
      </div>
    </WriterRibbonGroup>
  );
}

function StyleGalleryTile({
  styleOption,
  active,
  disabled,
  onClick,
}: {
  styleOption: WriterStyleOption;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={`${styleOption.label}: ${styleOption.description}`}
      aria-label={`Aplicar estilo ${styleOption.label}`}
      className={[
        "relative flex flex-1 items-center justify-center border-r border-zinc-200 px-2 text-center transition-colors",
        active
          ? "ring-1 ring-inset"
          : "bg-white hover:bg-blue-50",
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
      ].join(" ")}
      style={{
        height: STYLES_GROUP_LAYOUT.galleryTileHeight,
        minWidth: STYLES_GROUP_LAYOUT.galleryTileMinWidth,
        backgroundColor: active
          ? STYLES_GROUP_COLORS.activeBackground
          : undefined,
        color: active ? STYLES_GROUP_COLORS.activeText : undefined,
        boxShadow: active
          ? `inset 0 0 0 1px ${STYLES_GROUP_COLORS.activeBorder}`
          : undefined,
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span
        className={[
          "block max-w-full truncate leading-tight",
          styleOption.previewClassName,
        ].join(" ")}
        style={styleOption.previewStyle}
      >
        {styleOption.previewLabel}
      </span>
    </button>
  );
}

function StyleGalleryDropdown({
  disabled,
  selectedStyleId,
  selectedStyle,
  onSelect,
  onClear,
  onCreateStyle,
  onOpenInspector,
}: {
  disabled: boolean;
  selectedStyleId: WriterStyleId;
  selectedStyle: WriterStyleOption;
  onSelect: (styleId: WriterStyleId) => void;
  onClear: () => void;
  onCreateStyle?: () => void;
  onOpenInspector?: () => void;
}) {
  return (
    <FloatingDropdownButton
      label="Mais estilos"
      tooltip={`Mais estilos. Atual: ${selectedStyle.label}`}
      disabled={disabled}
      menuWidth={STYLES_GROUP_MENU_LAYOUT.galleryMenuWidth}
      renderButton={({ isOpen, toggle }) => (
        <button
          type="button"
          disabled={disabled}
          aria-label="Mais estilos"
          title="Mais estilos"
          className={[
            "flex shrink-0 items-center justify-center border-l border-zinc-300 bg-[#f8f8f8] text-zinc-800 transition-colors hover:bg-zinc-100",
            isOpen ? "bg-blue-50 text-blue-800" : "",
            disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
          ].join(" ")}
          style={{
            height: STYLES_GROUP_LAYOUT.galleryTileHeight,
            width: STYLES_GROUP_LAYOUT.dropdownButtonWidth,
          }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
    >
      {({ close }) => (
        <StylesDropdownMenu
          selectedStyleId={selectedStyleId}
          onSelect={(styleId) => {
            onSelect(styleId);
            close();
          }}
          onClear={() => {
            onClear();
            close();
          }}
          onCreateStyle={() => {
            onCreateStyle?.();
            close();
          }}
          onOpenInspector={() => {
            onOpenInspector?.();
            close();
          }}
        />
      )}
    </FloatingDropdownButton>
  );
}

function StylesDropdownMenu({
  selectedStyleId,
  onSelect,
  onClear,
  onCreateStyle,
  onOpenInspector,
}: {
  selectedStyleId: WriterStyleId;
  onSelect: (styleId: WriterStyleId) => void;
  onClear: () => void;
  onCreateStyle: () => void;
  onOpenInspector: () => void;
}) {
  const categories = useMemo(() => {
    const grouped = new Map<WriterStyleOption["category"], WriterStyleOption[]>();

    for (const style of WRITER_STYLES) {
      const current = grouped.get(style.category) || [];
      current.push(style);
      grouped.set(style.category, current);
    }

    return Array.from(grouped.entries());
  }, []);

  return (
    <div
      className="overflow-auto rounded-md bg-white"
      style={{ maxHeight: STYLES_GROUP_MENU_LAYOUT.menuMaxHeight }}
    >
      <div className="border-b border-zinc-200 px-3 py-2">
        <div className="text-[12px] font-semibold text-zinc-800">
          Galeria de estilos
        </div>
        <div className="text-[10px] text-zinc-500">
          Escolha um estilo para aplicar ao parágrafo ou trecho selecionado.
        </div>
      </div>

      <div className="p-2">
        {categories.map(([category, styles]) => (
          <div key={category} className="mb-2 last:mb-0">
            <div className="mb-1 px-1 text-[11px] font-semibold text-zinc-600">
              {category}
            </div>

            <div className="grid grid-cols-2 gap-1">
              {styles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  title={style.description}
                  className={[
                    "flex min-h-[54px] items-center gap-2 rounded border p-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50",
                    selectedStyleId === style.id
                      ? "border-blue-400 bg-blue-50"
                      : "border-zinc-200 bg-white",
                  ].join(" ")}
                  onClick={() => onSelect(style.id)}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-700">
                    {selectedStyleId === style.id ? (
                      <Check className="h-4 w-4" />
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        "block truncate leading-tight",
                        style.previewClassName,
                      ].join(" ")}
                      style={style.previewStyle}
                    >
                      {style.previewLabel}
                    </span>

                    <span className="mt-0.5 block truncate text-[10px] text-zinc-500">
                      {style.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-200 bg-[#f6f6f6] p-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-zinc-800 hover:bg-zinc-200"
          onClick={onClear}
        >
          <Eraser className="h-4 w-4" />
          Limpar formatação de estilo
        </button>

        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-zinc-800 hover:bg-zinc-200"
          onClick={onCreateStyle}
        >
          <Plus className="h-4 w-4" />
          Criar um estilo a partir da seleção
        </button>

        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-zinc-800 hover:bg-zinc-200"
          onClick={onOpenInspector}
        >
          <ListChecks className="h-4 w-4" />
          Inspetor de estilos
        </button>

        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-zinc-800 hover:bg-zinc-200"
          onClick={onOpenInspector}
        >
          <Paintbrush className="h-4 w-4" />
          Gerenciar estilos
        </button>
      </div>
    </div>
  );
}

function FloatingDropdownButton({
  label,
  tooltip,
  disabled = false,
  menuWidth,
  renderButton,
  children,
}: {
  label: string;
  tooltip: string;
  disabled?: boolean;
  menuWidth: number;
  renderButton: (helpers: { isOpen: boolean; toggle: () => void }) => ReactNode;
  children: (helpers: DropdownRenderProps) => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition>({
    top: 0,
    left: 0,
    minWidth: menuWidth,
  });

  const anchorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    const anchorRect = anchorRef.current?.getBoundingClientRect();

    if (!anchorRect || typeof window === "undefined") {
      return;
    }

    const gapPx = STYLES_GROUP_LAYOUT.menuViewportGap;
    const safePaddingPx = STYLES_GROUP_LAYOUT.menuViewportPadding;
    const viewportWidth = window.innerWidth;

    const preferredLeft = anchorRect.right - menuWidth;
    const maxLeft = Math.max(
      safePaddingPx,
      viewportWidth - menuWidth - safePaddingPx,
    );

    setMenuPosition({
      top: anchorRect.bottom + gapPx,
      left: Math.min(Math.max(safePaddingPx, preferredLeft), maxLeft),
      minWidth: Math.max(menuWidth, anchorRect.width),
    });
  }, [menuWidth]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  useCloseOnOutsideInteraction(
    [anchorRef, menuRef],
    isOpen,
    () => setIsOpen(false),
  );

  const toggle = () => {
    if (disabled) {
      return;
    }

    updateMenuPosition();
    setIsOpen((current) => !current);
  };

  return (
    <>
      <div ref={anchorRef} aria-label={label} title={tooltip}>
        {renderButton({
          isOpen,
          toggle,
        })}
      </div>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed overflow-auto rounded-md border bg-white shadow-2xl"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                minWidth: menuPosition.minWidth,
                maxHeight: STYLES_GROUP_MENU_LAYOUT.menuMaxHeight,
                zIndex: STYLES_GROUP_LAYOUT.menuZIndex,
                borderColor: STYLES_GROUP_COLORS.menuBorder,
              }}
            >
              {children({ close: () => setIsOpen(false) })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function getStyleOption(styleId: WriterStyleId) {
  return (
    WRITER_STYLES.find((style) => style.id === styleId) || WRITER_STYLES[0]
  );
}

function useCloseOnOutsideInteraction(
  refs: Array<RefObject<HTMLElement | null>>,
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (
        target &&
        refs.some((ref) => ref.current && ref.current.contains(target))
      ) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, refs]);
}
