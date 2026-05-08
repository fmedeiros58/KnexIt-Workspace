"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  FileSearch,
  MousePointer2,
  Search,
  TextCursorInput,
} from "lucide-react";
import { WriterRibbonGroup } from "../../WriterRibbonGroup";

type FindMode = "find" | "advanced-find" | "go-to";
type ReplaceMode = "replace" | "replace-all" | "advanced-replace";
type SelectMode =
  | "select-all"
  | "select-objects"
  | "select-similar-formatting"
  | "selection-pane";

type DocumentEditingCommands = {
  openFind: (mode?: FindMode) => void;
  openReplace: (mode?: ReplaceMode) => void;
  selectAll: () => void;
  selectObjects: () => void;
  selectSimilarFormatting: () => void;
  openSelectionPane: () => void;
};

type DocumentGroupProps = {
  commands?: Partial<DocumentEditingCommands>;
  disabled?: boolean;
  canFind?: boolean;
  canReplace?: boolean;
  canSelect?: boolean;

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

const DOCUMENT_GROUP_LAYOUT = {
  minWidth: 116,
  containerGap: 1,
  containerPaddingX: 4,
  containerPaddingTop: 2,
  containerPaddingBottom: 12,
  rowButtonHeight: 24,
  rowButtonTextSize: 11,
  rowIconSize: 16,
  dropdownChevronSize: 12,
  dropdownTriggerWidth: 20,
  launcherSize: 16,
  launcherFontSize: 12,
  menuViewportGap: 6,
  menuViewportPadding: 8,
  menuZIndex: 120000,
} as const;

const DOCUMENT_GROUP_COLORS = {
  selectorBorder: "#93c5fd",
  selectorBackground: "#dbeafe",
  selectorText: "#1e40af",
  defaultText: "#27272a",
  disabledOpacity: 0.45,
  menuBorder: "#d4d4d8",
} as const;

const DOCUMENT_GROUP_MENU_LAYOUT = {
  findMenuWidth: 286,
  replaceMenuWidth: 306,
  selectMenuWidth: 324,
  menuPadding: 8,
  menuGap: 4,
  menuMaxHeight: "min(78vh,520px)",
} as const;

const FIND_OPTIONS: Array<{
  id: FindMode;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: "find",
    label: "Localizar",
    description: "Abrir a busca no documento.",
    icon: <Search className="h-4 w-4" />,
  },
  {
    id: "advanced-find",
    label: "Localização avançada",
    description: "Buscar com mais critérios no documento.",
    icon: <FileSearch className="h-4 w-4" />,
  },
  {
    id: "go-to",
    label: "Ir para...",
    description: "Ir para página, seção, linha ou marcador.",
    icon: <TextCursorInput className="h-4 w-4" />,
  },
];

const REPLACE_OPTIONS: Array<{
  id: ReplaceMode;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: "replace",
    label: "Substituir",
    description: "Localizar um texto e substituir por outro.",
    icon: <ReplaceVisualIcon />,
  },
  {
    id: "replace-all",
    label: "Substituir tudo",
    description: "Substituir todas as ocorrências encontradas.",
    icon: <ReplaceAllVisualIcon />,
  },
  {
    id: "advanced-replace",
    label: "Substituição avançada",
    description: "Substituir com critérios de formato e escopo.",
    icon: <FileSearch className="h-4 w-4" />,
  },
];

const SELECT_OPTIONS: Array<{
  id: SelectMode;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: "select-all",
    label: "Selecionar tudo",
    description: "Selecionar todo o conteúdo do documento.",
    icon: <SelectionBoxIcon />,
  },
  {
    id: "select-objects",
    label: "Selecionar objetos",
    description: "Selecionar imagens, formas e outros objetos.",
    icon: <MousePointer2 className="h-4 w-4" />,
  },
  {
    id: "select-similar-formatting",
    label: "Selecionar texto com formatação semelhante",
    description: "Selecionar trechos que tenham a mesma aparência.",
    icon: <SimilarFormattingIcon />,
  },
  {
    id: "selection-pane",
    label: "Painel de seleção",
    description: "Abrir uma lista de objetos e elementos selecionáveis.",
    icon: <SelectionPaneIcon />,
  },
];

export function DocumentGroup({
  commands,
  disabled = false,
  canFind = true,
  canReplace = true,
  canSelect = true,
}: DocumentGroupProps = {}) {
  const handleFind = (mode: FindMode = "find") => {
    commands?.openFind?.(mode);
  };

  const handleReplace = (mode: ReplaceMode = "replace") => {
    commands?.openReplace?.(mode);
  };

  const handleSelect = (mode: SelectMode) => {
    if (mode === "select-all") {
      commands?.selectAll?.();
      return;
    }

    if (mode === "select-objects") {
      commands?.selectObjects?.();
      return;
    }

    if (mode === "select-similar-formatting") {
      commands?.selectSimilarFormatting?.();
      return;
    }

    commands?.openSelectionPane?.();
  };

  return (
    <WriterRibbonGroup title="Editando">
      <div
        className="relative flex flex-col justify-start"
        style={{
          minWidth: DOCUMENT_GROUP_LAYOUT.minWidth,
          gap: DOCUMENT_GROUP_LAYOUT.containerGap,
          paddingLeft: DOCUMENT_GROUP_LAYOUT.containerPaddingX,
          paddingRight: DOCUMENT_GROUP_LAYOUT.containerPaddingX,
          paddingTop: DOCUMENT_GROUP_LAYOUT.containerPaddingTop,
          paddingBottom: DOCUMENT_GROUP_LAYOUT.containerPaddingBottom,
        }}
      >
        <DocumentEditingDropdown
          label="Localizar"
          tooltip="Localizar texto no documento"
          disabled={disabled || !canFind}
          menuWidth={DOCUMENT_GROUP_MENU_LAYOUT.findMenuWidth}
          icon={
            <Search
              style={{
                width: DOCUMENT_GROUP_LAYOUT.rowIconSize,
                height: DOCUMENT_GROUP_LAYOUT.rowIconSize,
              }}
            />
          }
        >
          {({ close }) => (
            <FindMenu
              onSelect={(mode) => {
                handleFind(mode);
                close();
              }}
            />
          )}
        </DocumentEditingDropdown>

        <DocumentEditingButton
          label="Substituir"
          tooltip="Substituir texto no documento"
          disabled={disabled || !canReplace}
          icon={<ReplaceVisualIcon />}
          onClick={() => handleReplace("replace")}
          dropdown={{
            menuWidth: DOCUMENT_GROUP_MENU_LAYOUT.replaceMenuWidth,
            content: ({ close }) => (
              <ReplaceMenu
                onSelect={(mode) => {
                  handleReplace(mode);
                  close();
                }}
              />
            ),
          }}
        />

        <DocumentEditingDropdown
          label="Selecionar"
          tooltip="Selecionar texto ou objetos"
          disabled={disabled || !canSelect}
          menuWidth={DOCUMENT_GROUP_MENU_LAYOUT.selectMenuWidth}
          icon={
            <MousePointer2
              style={{
                width: DOCUMENT_GROUP_LAYOUT.rowIconSize,
                height: DOCUMENT_GROUP_LAYOUT.rowIconSize,
              }}
            />
          }
        >
          {({ close }) => (
            <SelectMenu
              onSelect={(mode) => {
                handleSelect(mode);
                close();
              }}
            />
          )}
        </DocumentEditingDropdown>

        <button
          type="button"
          aria-label="Abrir painel de edição"
          title="Abrir painel de edição"
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-sm text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
          style={{
            width: DOCUMENT_GROUP_LAYOUT.launcherSize,
            height: DOCUMENT_GROUP_LAYOUT.launcherSize,
          }}
          onClick={(event) => {
            event.stopPropagation();
            commands?.openFind?.("advanced-find");
          }}
        >
          <span
            className="leading-none"
            style={{ fontSize: DOCUMENT_GROUP_LAYOUT.launcherFontSize }}
          >
            ↘
          </span>
        </button>
      </div>
    </WriterRibbonGroup>
  );
}

function DocumentEditingButton({
  label,
  tooltip,
  icon,
  disabled,
  onClick,
  dropdown,
}: {
  label: string;
  tooltip: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  dropdown?: {
    menuWidth: number;
    content: (helpers: DropdownRenderProps) => ReactNode;
  };
}) {
  if (dropdown) {
    return (
      <DocumentEditingDropdown
        label={label}
        tooltip={tooltip}
        disabled={disabled}
        menuWidth={dropdown.menuWidth}
        icon={icon}
        mainAction={onClick}
      >
        {dropdown.content}
      </DocumentEditingDropdown>
    );
  }

  return (
    <button
      type="button"
      aria-label={tooltip}
      title={tooltip}
      disabled={disabled}
      className={[
        "flex w-full items-center gap-1 rounded border border-transparent px-1 text-left text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-white",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
      style={{
        height: DOCUMENT_GROUP_LAYOUT.rowButtonHeight,
        fontSize: DOCUMENT_GROUP_LAYOUT.rowButtonTextSize,
        opacity: disabled ? DOCUMENT_GROUP_COLORS.disabledOpacity : 1,
      }}
      onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) =>
        event.preventDefault()
      }
      onClick={onClick}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function DocumentEditingDropdown({
  label,
  tooltip,
  icon,
  disabled = false,
  menuWidth,
  mainAction,
  children,
}: {
  label: string;
  tooltip: string;
  icon: ReactNode;
  disabled?: boolean;
  menuWidth: number;
  mainAction?: () => void;
  children: (helpers: DropdownRenderProps) => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition>({
    top: 0,
    left: 0,
    minWidth: menuWidth,
  });

  const buttonRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    const buttonRect = buttonRef.current?.getBoundingClientRect();

    if (!buttonRect || typeof window === "undefined") {
      return;
    }

    const gapPx = DOCUMENT_GROUP_LAYOUT.menuViewportGap;
    const safePaddingPx = DOCUMENT_GROUP_LAYOUT.menuViewportPadding;
    const viewportWidth = window.innerWidth;

    const maxLeft = Math.max(
      safePaddingPx,
      viewportWidth - menuWidth - safePaddingPx,
    );

    setMenuPosition({
      top: buttonRect.bottom + gapPx,
      left: Math.min(Math.max(safePaddingPx, buttonRect.left), maxLeft),
      minWidth: Math.max(menuWidth, buttonRect.width),
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
    [buttonRef, menuRef],
    isOpen,
    () => setIsOpen(false),
  );

  const toggle = () => {
    if (disabled) {
      return;
    }

    updateMenuPosition();
    setIsOpen((current: boolean) => !current);
  };

  return (
    <>
      <div
        ref={buttonRef}
        className={[
          "flex w-full items-center rounded border border-transparent text-left text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-white",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
        aria-disabled={disabled}
        title={tooltip}
        style={{
          height: DOCUMENT_GROUP_LAYOUT.rowButtonHeight,
          fontSize: DOCUMENT_GROUP_LAYOUT.rowButtonTextSize,
          borderColor: isOpen ? DOCUMENT_GROUP_COLORS.selectorBorder : undefined,
          backgroundColor: isOpen
            ? DOCUMENT_GROUP_COLORS.selectorBackground
            : undefined,
          color: isOpen
            ? DOCUMENT_GROUP_COLORS.selectorText
            : DOCUMENT_GROUP_COLORS.defaultText,
          opacity: disabled ? DOCUMENT_GROUP_COLORS.disabledOpacity : 1,
        }}
      >
        <button
          type="button"
          disabled={disabled}
          aria-label={tooltip}
          title={tooltip}
          className="flex min-w-0 flex-1 items-center gap-1 bg-transparent px-1 text-left"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();

            if (mainAction) {
              mainAction();
              return;
            }

            toggle();
          }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-700">
            {icon}
          </span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          aria-label={`${label}: opções`}
          title={`${label}: opções`}
          className="flex h-full w-5 shrink-0 items-center justify-center bg-transparent text-zinc-700"
          style={{ width: DOCUMENT_GROUP_LAYOUT.dropdownTriggerWidth }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
        >
          <ChevronDown
            style={{
              width: DOCUMENT_GROUP_LAYOUT.dropdownChevronSize,
              height: DOCUMENT_GROUP_LAYOUT.dropdownChevronSize,
            }}
          />
        </button>
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
                maxHeight: DOCUMENT_GROUP_MENU_LAYOUT.menuMaxHeight,
                zIndex: DOCUMENT_GROUP_LAYOUT.menuZIndex,
                borderColor: DOCUMENT_GROUP_COLORS.menuBorder,
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

function FindMenu({ onSelect }: { onSelect: (mode: FindMode) => void }) {
  return (
    <MenuSection title="Localizar">
      {FIND_OPTIONS.map((option) => (
        <MenuItem
          key={option.id}
          label={option.label}
          description={option.description}
          icon={option.icon}
          onClick={() => onSelect(option.id)}
        />
      ))}
    </MenuSection>
  );
}

function ReplaceMenu({
  onSelect,
}: {
  onSelect: (mode: ReplaceMode) => void;
}) {
  return (
    <MenuSection title="Substituir">
      {REPLACE_OPTIONS.map((option) => (
        <MenuItem
          key={option.id}
          label={option.label}
          description={option.description}
          icon={option.icon}
          onClick={() => onSelect(option.id)}
        />
      ))}
    </MenuSection>
  );
}

function SelectMenu({ onSelect }: { onSelect: (mode: SelectMode) => void }) {
  return (
    <MenuSection title="Selecionar">
      {SELECT_OPTIONS.map((option) => (
        <MenuItem
          key={option.id}
          label={option.label}
          description={option.description}
          icon={option.icon}
          onClick={() => onSelect(option.id)}
        />
      ))}
    </MenuSection>
  );
}

function MenuSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: DOCUMENT_GROUP_MENU_LAYOUT.menuPadding }}>
      <div className="mb-2 px-1 text-[11px] font-semibold text-zinc-600">
        {title}
      </div>

      <div className="flex flex-col" style={{ gap: DOCUMENT_GROUP_MENU_LAYOUT.menuGap }}>
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  label,
  description,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-zinc-800 hover:bg-blue-50"
      onClick={onClick}
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-zinc-700">
        {icon}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] font-medium">{label}</span>
        <span className="mt-0.5 text-[10px] leading-snug text-zinc-500">
          {description}
        </span>
      </span>
    </button>
  );
}

function ReplaceVisualIcon() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute left-[2px] top-[2px] text-[10px] font-semibold leading-none text-blue-600">
        a
      </span>
      <span className="absolute left-[8px] top-[6px] text-[10px] font-semibold leading-none text-purple-600">
        b
      </span>
      <span className="absolute bottom-[2px] left-[4px] h-[1.5px] w-[12px] rotate-[-18deg] bg-blue-500" />
    </span>
  );
}

function ReplaceAllVisualIcon() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <ReplaceVisualIcon />
      <span className="absolute right-[1px] top-[1px] h-2 w-2 rounded-full border border-zinc-500 bg-white" />
    </span>
  );
}

function SelectionBoxIcon() {
  return (
    <span className="relative block h-5 w-5">
      <span className="absolute left-[3px] top-[3px] h-[14px] w-[14px] rounded-sm border border-zinc-700" />
      <span className="absolute left-[6px] top-[7px] h-[2px] w-[8px] rounded bg-zinc-700" />
      <span className="absolute left-[6px] top-[11px] h-[2px] w-[6px] rounded bg-zinc-700" />
    </span>
  );
}

function SimilarFormattingIcon() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute left-[3px] top-[4px] text-[11px] font-bold leading-none text-zinc-800">
        Aa
      </span>
      <span className="absolute bottom-[3px] left-[4px] h-[2px] w-[12px] rounded bg-blue-600" />
    </span>
  );
}

function SelectionPaneIcon() {
  return (
    <span className="relative block h-5 w-5">
      <span className="absolute left-[3px] top-[3px] h-[14px] w-[14px] rounded-sm border border-zinc-700" />
      <span className="absolute left-[6px] top-[6px] h-[1.5px] w-[8px] rounded bg-zinc-700" />
      <span className="absolute left-[6px] top-[10px] h-[1.5px] w-[8px] rounded bg-zinc-700" />
      <span className="absolute left-[6px] top-[14px] h-[1.5px] w-[8px] rounded bg-zinc-700" />
    </span>
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
