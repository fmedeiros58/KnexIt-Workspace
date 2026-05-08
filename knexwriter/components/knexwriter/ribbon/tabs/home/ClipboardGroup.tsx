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
  Clipboard,
  ClipboardCheck,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Paintbrush,
  Scissors,
} from "lucide-react";
import { WriterRibbonGroup } from "../../WriterRibbonGroup";

type PasteMode =
  | "default"
  | "keep-source-formatting"
  | "merge-formatting"
  | "plain-text";

type ClipboardCommands = {
  paste: (mode?: PasteMode) => void;
  pastePlainText: (text?: string) => void;
  cut: () => void;
  copy: () => void;
  toggleFormatPainter: () => void;
  openClipboardPane: () => void;
};

type ClipboardGroupProps = {
  commands?: Partial<ClipboardCommands>;
  disabled?: boolean;
  canPaste?: boolean;
  canCut?: boolean;
  canCopy?: boolean;
  isFormatPainterActive?: boolean;

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

const CLIPBOARD_GROUP_LAYOUT = {
  minWidth: 198,
  containerGap: 8,
  containerPaddingX: 4,
  containerPaddingBottom: 12,
  sideColumnHeight: 76,
  sideColumnMinWidth: 132,
  sideColumnGap: 1,
  sideColumnPaddingTop: 2,
  splitButtonWidth: 54,
  splitPrimaryWidth: 50,
  launcherSize: 16,
  launcherFontSize: 12,
  smallButtonHeight: 24,
  wideButtonHeight: 24,
  buttonTextSize: 11,
  iconSize: 16,
  dropdownChevronSize: 12,
  menuViewportGap: 6,
  menuViewportPadding: 8,
  menuZIndex: 120000,
} as const;

const CLIPBOARD_GROUP_COLORS = {
  activeBorder: "#93c5fd",
  activeBackground: "#dbeafe",
  activeText: "#1e40af",
  hoverBackground: "#eff6ff",
  defaultText: "#27272a",
  disabledOpacity: 0.45,
  menuBorder: "#d4d4d8",
} as const;

const CLIPBOARD_GROUP_MENU_LAYOUT = {
  pasteMenuWidth: 286,
  menuPadding: 8,
  menuGap: 4,
  menuMaxHeight: "min(78vh,520px)",
} as const;

const PASTE_OPTIONS: Array<{
  id: PasteMode;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: "default",
    label: "Colar",
    description: "Cola o conteúdo usando o comportamento padrão do editor.",
    icon: <ClipboardPaste className="h-4 w-4" />,
  },
  {
    id: "keep-source-formatting",
    label: "Manter formatação original",
    description: "Preserva a formatação de origem, quando disponível.",
    icon: <ClipboardCheck className="h-4 w-4" />,
  },
  {
    id: "merge-formatting",
    label: "Mesclar formatação",
    description: "Adapta o conteúdo à formatação do documento atual.",
    icon: <ClipboardCopy className="h-4 w-4" />,
  },
  {
    id: "plain-text",
    label: "Manter somente texto",
    description: "Cola apenas o texto, sem estilos ou formatações.",
    icon: <Clipboard className="h-4 w-4" />,
  },
];

export function ClipboardGroup({
  commands,
  disabled = false,
  canPaste = true,
  canCut = true,
  canCopy = true,
  isFormatPainterActive = false,
}: ClipboardGroupProps = {}) {
  const [formatPainterActive, setFormatPainterActive] =
    useState(isFormatPainterActive);

  useEffect(() => {
    setFormatPainterActive(isFormatPainterActive);
  }, [isFormatPainterActive]);

  const tryBrowserCopy = () => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      document.execCommand("copy");
    } catch {
      // O navegador pode bloquear comandos diretos de área de transferência.
    }
  };

  const tryBrowserCut = () => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      document.execCommand("cut");
    } catch {
      // O navegador pode bloquear comandos diretos de área de transferência.
    }
  };

  const tryBrowserPaste = async (mode: PasteMode) => {
    if (mode === "plain-text" && typeof navigator !== "undefined") {
      try {
        const text = await navigator.clipboard?.readText?.();

        if (typeof text === "string") {
          commands?.pastePlainText?.(text);
          return;
        }
      } catch {
        // Leitura do clipboard exige permissão do navegador.
      }
    }

    commands?.paste?.(mode);

    if (typeof document !== "undefined") {
      try {
        document.execCommand("paste");
      } catch {
        // Colar por execCommand costuma ser bloqueado por segurança.
      }
    }
  };

  const handlePaste = (mode: PasteMode = "default") => {
    void tryBrowserPaste(mode);
  };

  const handleCut = () => {
    if (commands?.cut) {
      commands.cut();
      return;
    }

    tryBrowserCut();
  };

  const handleCopy = () => {
    if (commands?.copy) {
      commands.copy();
      return;
    }

    tryBrowserCopy();
  };

  const handleFormatPainter = () => {
    setFormatPainterActive((current) => !current);
    commands?.toggleFormatPainter?.();
  };

  return (
    <WriterRibbonGroup title="Área de Transferência">
      <div
        className="relative flex items-start"
        style={{
          minWidth: CLIPBOARD_GROUP_LAYOUT.minWidth,
          gap: CLIPBOARD_GROUP_LAYOUT.containerGap,
          paddingLeft: CLIPBOARD_GROUP_LAYOUT.containerPaddingX,
          paddingRight: CLIPBOARD_GROUP_LAYOUT.containerPaddingX,
          paddingBottom: CLIPBOARD_GROUP_LAYOUT.containerPaddingBottom,
        }}
      >
        <PasteSplitButton
          disabled={disabled || !canPaste}
          onPaste={() => handlePaste("default")}
          onPasteMode={handlePaste}
        />

        <div
          className="flex flex-col justify-start"
          style={{
            height: CLIPBOARD_GROUP_LAYOUT.sideColumnHeight,
            minWidth: CLIPBOARD_GROUP_LAYOUT.sideColumnMinWidth,
            gap: CLIPBOARD_GROUP_LAYOUT.sideColumnGap,
            paddingTop: CLIPBOARD_GROUP_LAYOUT.sideColumnPaddingTop,
          }}
        >
          <ClipboardSmallButton
            label="Recortar"
            tooltip="Recortar"
            disabled={disabled || !canCut}
            icon={
              <Scissors
                style={{
                  width: CLIPBOARD_GROUP_LAYOUT.iconSize,
                  height: CLIPBOARD_GROUP_LAYOUT.iconSize,
                }}
              />
            }
            onClick={handleCut}
          />

          <ClipboardSmallButton
            label="Copiar"
            tooltip="Copiar"
            disabled={disabled || !canCopy}
            icon={
              <Copy
                style={{
                  width: CLIPBOARD_GROUP_LAYOUT.iconSize,
                  height: CLIPBOARD_GROUP_LAYOUT.iconSize,
                }}
              />
            }
            onClick={handleCopy}
          />

          <ClipboardWideButton
            label="Pincel de Formatação"
            tooltip="Copiar formatação de um trecho e aplicar em outro"
            active={formatPainterActive}
            disabled={disabled}
            icon={
              <Paintbrush
                style={{
                  width: CLIPBOARD_GROUP_LAYOUT.iconSize,
                  height: CLIPBOARD_GROUP_LAYOUT.iconSize,
                }}
              />
            }
            onClick={handleFormatPainter}
          />
        </div>

        <button
          type="button"
          aria-label="Abrir painel da área de transferência"
          title="Abrir painel da área de transferência"
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-sm text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
          style={{
            width: CLIPBOARD_GROUP_LAYOUT.launcherSize,
            height: CLIPBOARD_GROUP_LAYOUT.launcherSize,
            fontSize: CLIPBOARD_GROUP_LAYOUT.launcherFontSize,
          }}
          onClick={(event) => {
            event.stopPropagation();
            commands?.openClipboardPane?.();
          }}
        >
          <span className="leading-none">↘</span>
        </button>
      </div>
    </WriterRibbonGroup>
  );
}

function PasteSplitButton({
  disabled,
  onPaste,
  onPasteMode,
}: {
  disabled?: boolean;
  onPaste: () => void;
  onPasteMode: (mode: PasteMode) => void;
}) {
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center"
      style={{
        height: CLIPBOARD_GROUP_LAYOUT.sideColumnHeight,
        width: CLIPBOARD_GROUP_LAYOUT.splitButtonWidth,
      }}
    >
      <FloatingDropdownButton
        label="Colar"
        tooltip="Colar"
        disabled={disabled}
        menuWidth={CLIPBOARD_GROUP_MENU_LAYOUT.pasteMenuWidth}
        renderButton={({ isOpen, toggle }) => (
          <div
            className={[
              "flex flex-col items-center justify-center rounded border transition-colors",
              isOpen
                ? ""
                : "border-transparent bg-transparent hover:border-zinc-300 hover:bg-white",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
            aria-disabled={disabled}
            style={{
              height: CLIPBOARD_GROUP_LAYOUT.sideColumnHeight,
              width: CLIPBOARD_GROUP_LAYOUT.splitPrimaryWidth,
              borderColor: isOpen ? CLIPBOARD_GROUP_COLORS.activeBorder : undefined,
              backgroundColor: isOpen
                ? CLIPBOARD_GROUP_COLORS.activeBackground
                : undefined,
              opacity: disabled ? CLIPBOARD_GROUP_COLORS.disabledOpacity : 1,
            }}
          >
            <button
              type="button"
              disabled={disabled}
              aria-label="Colar"
              title="Colar"
              className="flex flex-1 flex-col items-center justify-end bg-transparent text-zinc-800"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                onPaste();
              }}
            >
              <ClipboardPaste className="h-7 w-7 text-orange-600" />
              <span
                className="mt-0.5 leading-none"
                style={{ fontSize: CLIPBOARD_GROUP_LAYOUT.buttonTextSize }}
              >
                Colar
              </span>
            </button>

            <button
              type="button"
              disabled={disabled}
              aria-label="Opções de colagem"
              title="Opções de colagem"
              className="flex h-4 w-full items-center justify-center bg-transparent text-zinc-700"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                toggle();
              }}
            >
              <ChevronDown
                style={{
                  width: CLIPBOARD_GROUP_LAYOUT.dropdownChevronSize,
                  height: CLIPBOARD_GROUP_LAYOUT.dropdownChevronSize,
                }}
              />
            </button>
          </div>
        )}
      >
        {({ close }) => (
          <PasteOptionsMenu
            onSelect={(mode) => {
              onPasteMode(mode);
              close();
            }}
          />
        )}
      </FloatingDropdownButton>
    </div>
  );
}

function PasteOptionsMenu({
  onSelect,
}: {
  onSelect: (mode: PasteMode) => void;
}) {
  return (
    <div style={{ padding: CLIPBOARD_GROUP_MENU_LAYOUT.menuPadding }}>
      <div className="mb-2 px-1 text-[11px] font-semibold text-zinc-600">
        Opções de colagem
      </div>

      <div className="flex flex-col" style={{ gap: CLIPBOARD_GROUP_MENU_LAYOUT.menuGap }}>
        {PASTE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-zinc-800 hover:bg-blue-50"
            onClick={() => onSelect(option.id)}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-zinc-700">
              {option.icon}
            </span>

            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[12px] font-medium">{option.label}</span>
              <span className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                {option.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 border-t border-zinc-200 pt-2">
        <div className="rounded bg-zinc-50 px-2 py-1.5 text-[10px] leading-snug text-zinc-500">
          Observação: alguns navegadores bloqueiam colagem automática por
          segurança. Quando isso ocorrer, use Ctrl+V no palco de escrita.
        </div>
      </div>
    </div>
  );
}

function ClipboardSmallButton({
  label,
  tooltip,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={tooltip}
      title={tooltip}
      disabled={disabled}
      className={[
        "flex w-full items-center gap-1 rounded border border-transparent px-1.5 text-left text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-white",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
      style={{
        height: CLIPBOARD_GROUP_LAYOUT.smallButtonHeight,
        fontSize: CLIPBOARD_GROUP_LAYOUT.buttonTextSize,
        color: CLIPBOARD_GROUP_COLORS.defaultText,
        opacity: disabled ? CLIPBOARD_GROUP_COLORS.disabledOpacity : 1,
      }}
      onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) =>
        event.preventDefault()
      }
      onClick={onClick}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-700">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function ClipboardWideButton({
  label,
  tooltip,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={tooltip}
      title={tooltip}
      disabled={disabled}
      className={[
        "flex w-full items-center gap-1 rounded border px-1.5 text-left transition-colors",
        active
          ? ""
          : "border-transparent bg-transparent text-zinc-800 hover:border-zinc-300 hover:bg-white",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
      style={{
        height: CLIPBOARD_GROUP_LAYOUT.wideButtonHeight,
        fontSize: CLIPBOARD_GROUP_LAYOUT.buttonTextSize,
        borderColor: active ? CLIPBOARD_GROUP_COLORS.activeBorder : undefined,
        backgroundColor: active
          ? CLIPBOARD_GROUP_COLORS.activeBackground
          : undefined,
        color: active
          ? CLIPBOARD_GROUP_COLORS.activeText
          : CLIPBOARD_GROUP_COLORS.defaultText,
        opacity: disabled ? CLIPBOARD_GROUP_COLORS.disabledOpacity : 1,
      }}
      onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) =>
        event.preventDefault()
      }
      onClick={onClick}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
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

    const gapPx = CLIPBOARD_GROUP_LAYOUT.menuViewportGap;
    const safePaddingPx = CLIPBOARD_GROUP_LAYOUT.menuViewportPadding;
    const viewportWidth = window.innerWidth;

    const maxLeft = Math.max(
      safePaddingPx,
      viewportWidth - menuWidth - safePaddingPx,
    );

    setMenuPosition({
      top: anchorRect.bottom + gapPx,
      left: Math.min(Math.max(safePaddingPx, anchorRect.left), maxLeft),
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
      <div
        ref={anchorRef}
        aria-label={label}
        title={tooltip}
        onClick={() => {
          if (!disabled) {
            updateMenuPosition();
          }
        }}
      >
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
                maxHeight: CLIPBOARD_GROUP_MENU_LAYOUT.menuMaxHeight,
                zIndex: CLIPBOARD_GROUP_LAYOUT.menuZIndex,
                borderColor: CLIPBOARD_GROUP_COLORS.menuBorder,
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
