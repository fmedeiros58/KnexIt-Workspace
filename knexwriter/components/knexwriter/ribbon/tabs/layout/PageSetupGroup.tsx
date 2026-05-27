import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { WriterRibbonGroup } from "../../WriterRibbonGroup";

const CSS_PX_PER_INCH = 96;
const MM_PER_INCH = 25.4;
const CM_PER_INCH = 2.54;

const SELECTOR_BG = "#F8E6EA";
const SELECTOR_BG_STRONG = "#F3CCD4";
const SELECTOR_BORDER = "#D9162F";

type PageOrientation = "portrait" | "landscape";

const PAPER_SIZES = [
  {
    id: "a4",
    label: "A4",
    widthMm: 210,
    heightMm: 297,
  },
  {
    id: "letter",
    label: "Carta",
    widthMm: 215.9,
    heightMm: 279.4,
  },
  {
    id: "legal",
    label: "Ofício americano",
    widthMm: 215.9,
    heightMm: 355.6,
  },
  {
    id: "oficio-9",
    label: "Ofício 9",
    widthMm: 215,
    heightMm: 315,
  },
  {
    id: "folio",
    label: "8,5 x 13 pol.",
    widthMm: 216,
    heightMm: 330,
  },
  {
    id: "mexico-oficio",
    label: "México-Ofício",
    widthMm: 216,
    heightMm: 341,
  },
  {
    id: "oficio-216-356",
    label: "Ofício",
    widthMm: 215.9,
    heightMm: 355.6,
  },
  {
    id: "executive",
    label: "Executivo",
    widthMm: 184.2,
    heightMm: 266.7,
  },
  {
    id: "envelope-10",
    label: "Envelope #10",
    widthMm: 104.8,
    heightMm: 241.3,
  },
  {
    id: "8x10",
    label: "8 x 10 pol.",
    widthMm: 203.2,
    heightMm: 254,
  },
  {
    id: "5x7",
    label: "5 x 7 pol.",
    widthMm: 127,
    heightMm: 178,
  },
  {
    id: "4x6",
    label: "4 x 6 pol.",
    widthMm: 101.6,
    heightMm: 152.4,
  },
  {
    id: "3-5x5",
    label: "3,5 x 5 pol.",
    widthMm: 89,
    heightMm: 127,
  },
  {
    id: "a6",
    label: "A6",
    widthMm: 105,
    heightMm: 148,
  },
  {
    id: "half-letter",
    label: "Meia carta",
    widthMm: 139.7,
    heightMm: 215.9,
  },
  {
    id: "11x17",
    label: "11 x 17 pol.",
    widthMm: 279.4,
    heightMm: 431.8,
  },
  {
    id: "a3",
    label: "A3",
    widthMm: 297,
    heightMm: 420,
  },
  {
    id: "super-b",
    label: "Super B",
    widthMm: 329,
    heightMm: 483,
  },
  {
    id: "17x22",
    label: "17 x 22 pol.",
    widthMm: 431.8,
    heightMm: 558.8,
  },
] as const;

type PaperSizeId = (typeof PAPER_SIZES)[number]["id"];

type PageMarginsCm = {
  topCm: number;
  rightCm: number;
  bottomCm: number;
  leftCm: number;
  headerCm: number;
  footerCm: number;
  gutterCm: number;
};

const MARGIN_PRESETS = [
  {
    id: "normal",
    label: "Normal",
    description: "2,54 cm em todos os lados",
    topCm: 2.54,
    rightCm: 2.54,
    bottomCm: 2.54,
    leftCm: 2.54,
    headerCm: 1.25,
    footerCm: 1.25,
    gutterCm: 0,
  },
  {
    id: "narrow",
    label: "Estreita",
    description: "1,27 cm em todos os lados",
    topCm: 1.27,
    rightCm: 1.27,
    bottomCm: 1.27,
    leftCm: 1.27,
    headerCm: 1.25,
    footerCm: 1.25,
    gutterCm: 0,
  },
  {
    id: "moderate",
    label: "Moderada",
    description: "Superior e inferior 2,54 cm; laterais 1,91 cm",
    topCm: 2.54,
    rightCm: 1.91,
    bottomCm: 2.54,
    leftCm: 1.91,
    headerCm: 1.25,
    footerCm: 1.25,
    gutterCm: 0,
  },
  {
    id: "wide",
    label: "Larga",
    description: "Superior e inferior 2,54 cm; laterais 5,08 cm",
    topCm: 2.54,
    rightCm: 5.08,
    bottomCm: 2.54,
    leftCm: 5.08,
    headerCm: 1.25,
    footerCm: 1.25,
    gutterCm: 0,
  },
  {
    id: "abnt",
    label: "ABNT",
    description: "Superior e esquerda 3 cm; direita e inferior 2 cm",
    topCm: 3,
    rightCm: 2,
    bottomCm: 2,
    leftCm: 3,
    headerCm: 1.25,
    footerCm: 1.25,
    gutterCm: 0,
  },
] as const;

type MarginPresetId = (typeof MARGIN_PRESETS)[number]["id"];

type PageSetupState = {
  paperSizeId: PaperSizeId;
  orientation: PageOrientation;
  margins: PageMarginsCm;
  columns: number;
  lineNumbers: "none" | "continuous" | "restart-page" | "restart-section";
  hyphenation: "none" | "auto" | "manual";
};

const DEFAULT_PAGE_SETUP: PageSetupState = {
  paperSizeId: "a4",
  orientation: "portrait",
  margins: {
    topCm: 2.54,
    rightCm: 2.54,
    bottomCm: 2.54,
    leftCm: 2.54,
    headerCm: 1.25,
    footerCm: 1.25,
    gutterCm: 0,
  },
  columns: 1,
  lineNumbers: "none",
  hyphenation: "none",
};

type PageSetupPatch = Partial<PageSetupState>;

type PageSetupGroupProps = {
  value?: Partial<PageSetupState>;
  onPageSetupChange?: (patch: PageSetupPatch, next: PageSetupState) => void;
};

type MenuOption = {
  value: string;
  label: string;
  description?: string;
};

type IconTone = {
  ink?: string;
  accent?: string;
  paper?: string;
};

export function PageSetupGroup({
  value,
  onPageSetupChange,
}: PageSetupGroupProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const current: PageSetupState = {
    ...DEFAULT_PAGE_SETUP,
    ...value,
    margins: {
      ...DEFAULT_PAGE_SETUP.margins,
      ...value?.margins,
    },
  };

  function emitChange(patch: PageSetupPatch) {
    const next: PageSetupState = {
      ...current,
      ...patch,
      margins: {
        ...current.margins,
        ...patch.margins,
      },
    };

    onPageSetupChange?.(patch, next);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("writer:page-setup-change", {
          detail: {
            patch,
            next,
          },
        })
      );
    }
  }

  function emitCommand(command: string, payload?: unknown) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("writer:page-setup-command", {
          detail: {
            command,
            payload,
          },
        })
      );
    }
  }

  const marginOptions: MenuOption[] = MARGIN_PRESETS.map((preset) => ({
    value: preset.id,
    label: preset.label,
    description: preset.description,
  }));

  const paperOptions: MenuOption[] = PAPER_SIZES.map((paper) => ({
    value: paper.id,
    label: paper.label,
    description: `${formatNumber(paper.widthMm / 10)} cm x ${formatNumber(
      paper.heightMm / 10
    )} cm`,
  }));

  const orientationOptions: MenuOption[] = [
    {
      value: "portrait",
      label: "Retrato",
      description: "Página na posição vertical",
    },
    {
      value: "landscape",
      label: "Paisagem",
      description: "Página na posição horizontal",
    },
  ];

  const columnOptions: MenuOption[] = [
    {
      value: "1",
      label: "Uma",
      description: "Uma coluna",
    },
    {
      value: "2",
      label: "Duas",
      description: "Duas colunas",
    },
    {
      value: "3",
      label: "Três",
      description: "Três colunas",
    },
    {
      value: "left",
      label: "Esquerda",
      description: "Coluna estreita à esquerda",
    },
    {
      value: "right",
      label: "Direita",
      description: "Coluna estreita à direita",
    },
  ];

  const breakOptions: MenuOption[] = [
    {
      value: "page",
      label: "Página",
      description: "Insere uma quebra de página",
    },
    {
      value: "column",
      label: "Coluna",
      description: "Insere uma quebra de coluna",
    },
    {
      value: "text-wrapping",
      label: "Quebra de texto",
      description: "Separa o texto ao redor de objetos",
    },
    {
      value: "section-next-page",
      label: "Próxima página",
      description: "Nova seção na próxima página",
    },
    {
      value: "section-continuous",
      label: "Contínua",
      description: "Nova seção na mesma página",
    },
    {
      value: "section-even-page",
      label: "Página par",
      description: "Nova seção na próxima página par",
    },
    {
      value: "section-odd-page",
      label: "Página ímpar",
      description: "Nova seção na próxima página ímpar",
    },
  ];

  const lineNumberOptions: MenuOption[] = [
    {
      value: "none",
      label: "Nenhum",
      description: "Não exibir números de linha",
    },
    {
      value: "continuous",
      label: "Contínuo",
      description: "Numerar linhas continuamente",
    },
    {
      value: "restart-page",
      label: "Reiniciar a cada página",
      description: "A numeração reinicia em cada página",
    },
    {
      value: "restart-section",
      label: "Reiniciar a cada seção",
      description: "A numeração reinicia em cada seção",
    },
  ];

  const hyphenationOptions: MenuOption[] = [
    {
      value: "none",
      label: "Nenhuma",
      description: "Não aplicar hifenização",
    },
    {
      value: "auto",
      label: "Automática",
      description: "Aplicar hifenização automática",
    },
    {
      value: "manual",
      label: "Manual",
      description: "Aplicar hifenização manual",
    },
  ];

  return (
    <WriterRibbonGroup title="Configurar página">
      <div style={styles.root}>
        <RibbonMenuButton
          id="margins"
          label="Margens"
          tooltip="Configurar margens da página"
          icon={<MarginsIcon />}
          variant="large"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          options={marginOptions}
          onSelect={(selectedValue) => {
            emitChange({
              margins: getMarginPreset(selectedValue as MarginPresetId),
            });
          }}
        />

        <RibbonMenuButton
          id="orientation"
          label="Orientação"
          tooltip="Alterar orientação da página"
          icon={<OrientationIcon />}
          variant="large"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          options={orientationOptions}
          onSelect={(selectedValue) => {
            emitChange({
              orientation: selectedValue as PageOrientation,
            });
          }}
        />

        <RibbonMenuButton
          id="paper-size"
          label="Tamanho"
          tooltip="Alterar tamanho da folha"
          icon={<PaperSizeIcon />}
          variant="large"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          options={paperOptions}
          onSelect={(selectedValue) => {
            if (selectedValue === "__more-paper-sizes__") {
              emitCommand("open-paper-size-dialog");
              return;
            }

            emitChange({
              paperSizeId: selectedValue as PaperSizeId,
            });
          }}
        />

        <RibbonMenuButton
          id="columns"
          label="Colunas"
          tooltip="Configurar colunas do texto"
          icon={<ColumnsIcon />}
          variant="large"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          options={columnOptions}
          onSelect={(selectedValue) => {
            if (selectedValue === "left" || selectedValue === "right") {
              emitCommand("set-special-columns", {
                mode: selectedValue,
              });

              return;
            }

            emitChange({
              columns: Number(selectedValue),
            });
          }}
        />

        <div style={styles.compactStack}>
          <RibbonMenuButton
            id="breaks"
            label="Quebras"
            tooltip="Inserir quebras de página, coluna ou seção"
            icon={<BreaksIcon />}
            variant="compact"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            options={breakOptions}
            onSelect={(selectedValue) => {
              emitCommand("insert-break", {
                breakType: selectedValue,
              });
            }}
          />

          <RibbonMenuButton
            id="line-numbers"
            label="Números de Linha"
            tooltip="Configurar números de linha"
            icon={<LineNumbersIcon />}
            variant="compact"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            options={lineNumberOptions}
            onSelect={(selectedValue) => {
              emitChange({
                lineNumbers: selectedValue as PageSetupState["lineNumbers"],
              });
            }}
          />

          <RibbonMenuButton
            id="hyphenation"
            label="Hifenização"
            tooltip="Configurar hifenização do texto"
            icon={<HyphenationIcon />}
            variant="compact"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            options={hyphenationOptions}
            onSelect={(selectedValue) => {
              emitChange({
                hyphenation: selectedValue as PageSetupState["hyphenation"],
              });
            }}
          />
        </div>
      </div>
    </WriterRibbonGroup>
  );
}

type RibbonMenuButtonProps = {
  id: string;
  label: string;
  tooltip: string;
  icon: ReactNode;
  variant: "large" | "compact";
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  options: MenuOption[];
  onSelect: (value: string) => void;
};

function RibbonMenuButton({
  id,
  label,
  tooltip,
  icon,
  variant,
  openMenu,
  setOpenMenu,
  options,
  onSelect,
}: RibbonMenuButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [hoveredMenuValue, setHoveredMenuValue] = useState<string | null>(null);

  const isOpen = openMenu === id;
  const menuDomId = `writer-page-setup-menu-${id}`;
  const baseButtonStyle =
    variant === "large" ? styles.largeButton : styles.compactButton;
  const buttonStyle: CSSProperties =
    isOpen || isButtonHovered
      ? {
          ...baseButtonStyle,
          ...styles.ribbonButtonSelected,
        }
      : baseButtonStyle;

  function updateMenuPosition() {
    if (typeof window === "undefined") {
      return;
    }

    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const preferredWidth =
      id === "paper-size" ? 286 : variant === "large" ? 240 : 260;
    const safeLeft = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - preferredWidth - 8)
    );

    setMenuPosition({
      top: rect.bottom + 2,
      left: safeLeft,
      minWidth: preferredWidth,
    });
  }

  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();

    function handleWindowChange() {
      updateMenuPosition();
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      const button = buttonRef.current;
      const menu = document.getElementById(menuDomId);

      if (target && button?.contains(target)) {
        return;
      }

      if (target && menu?.contains(target)) {
        return;
      }

      setOpenMenu(null);
    }

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen, menuDomId, setOpenMenu]);

  const menuPortal =
    typeof document !== "undefined" && isOpen && menuPosition
      ? createPortal(
          <div
            id={menuDomId}
            role="menu"
            style={{
              ...styles.menu,
              ...(id === "paper-size" ? styles.paperMenu : null),
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: menuPosition.minWidth,
              ...(id === "paper-size"
                ? {
                    maxHeight: `min(430px, calc(100vh - ${menuPosition.top + 8}px))`,
                  }
                : null),
            }}
          >
            {id === "paper-size" ? (
              <>
                <div style={styles.paperMenuScroll}>
                  {options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitem"
                      style={
                        hoveredMenuValue === option.value
                          ? {
                              ...styles.paperMenuItem,
                              ...styles.paperMenuItemSelected,
                            }
                          : styles.paperMenuItem
                      }
                      onMouseEnter={() => setHoveredMenuValue(option.value)}
                      onMouseLeave={() => setHoveredMenuValue(null)}
                      onClick={() => {
                        onSelect(option.value);
                        setOpenMenu(null);
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={getPaperPreviewStyle(option.value)}
                      />

                      <span style={styles.paperMenuText}>
                        <span style={styles.paperMenuItemLabel}>
                          {`${option.label} (${formatPaperMm(option.value)})`}
                        </span>

                        {option.description && (
                          <span style={styles.paperMenuItemDescription}>
                            {option.description}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  role="menuitem"
                  style={
                    hoveredMenuValue === "__more-paper-sizes__"
                      ? {
                          ...styles.paperMoreButton,
                          ...styles.paperMoreButtonSelected,
                        }
                      : styles.paperMoreButton
                  }
                  onMouseEnter={() =>
                    setHoveredMenuValue("__more-paper-sizes__")
                  }
                  onMouseLeave={() => setHoveredMenuValue(null)}
                  onClick={() => {
                    onSelect("__more-paper-sizes__");
                    setOpenMenu(null);
                  }}
                >
                  Mais Tamanhos de Papel...
                </button>
              </>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  style={
                    hoveredMenuValue === option.value
                      ? {
                          ...styles.menuItem,
                          ...styles.menuItemSelected,
                        }
                      : styles.menuItem
                  }
                  onMouseEnter={() => setHoveredMenuValue(option.value)}
                  onMouseLeave={() => setHoveredMenuValue(null)}
                  onClick={() => {
                    onSelect(option.value);
                    setOpenMenu(null);
                  }}
                >
                  <span style={styles.menuItemText}>
                    <span style={styles.menuItemLabel}>{option.label}</span>

                    {option.description && (
                      <span style={styles.menuItemDescription}>
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div style={styles.menuHost}>
      <button
        ref={buttonRef}
        type="button"
        title={tooltip}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={buttonStyle}
        onMouseEnter={() => setIsButtonHovered(true)}
        onMouseLeave={() => setIsButtonHovered(false)}
        onClick={() => {
          if (isOpen) {
            setOpenMenu(null);
            return;
          }

          setOpenMenu(id);
        }}
      >
        <span
          style={variant === "large" ? styles.largeIcon : styles.compactIcon}
        >
          {icon}
        </span>

        <span
          style={variant === "large" ? styles.largeLabel : styles.compactLabel}
        >
          {label}
        </span>

        <span
          style={
            variant === "large"
              ? styles.largeChevron
              : styles.compactChevron
          }
          aria-hidden="true"
        >
          <RibbonChevron />
        </span>
      </button>

      {menuPortal}
    </div>
  );
}

function getMarginPreset(presetId: MarginPresetId): PageMarginsCm {
  const preset = MARGIN_PRESETS.find((item) => item.id === presetId);

  if (!preset) {
    return { ...DEFAULT_PAGE_SETUP.margins };
  }

  return {
    topCm: preset.topCm,
    rightCm: preset.rightCm,
    bottomCm: preset.bottomCm,
    leftCm: preset.leftCm,
    headerCm: preset.headerCm,
    footerCm: preset.footerCm,
    gutterCm: preset.gutterCm,
  };
}

function mmToCssPx(mm: number): number {
  return (mm / MM_PER_INCH) * CSS_PX_PER_INCH;
}

function cmToCssPx(cm: number): number {
  return (cm / CM_PER_INCH) * CSS_PX_PER_INCH;
}

function getPaperSizeMm(
  paperSizeId: PaperSizeId,
  orientation: PageOrientation = "portrait"
) {
  const paper = PAPER_SIZES.find((item) => item.id === paperSizeId);
  const safePaper = paper ?? PAPER_SIZES[0];

  if (orientation === "landscape") {
    return {
      widthMm: safePaper.heightMm,
      heightMm: safePaper.widthMm,
    };
  }

  return {
    widthMm: safePaper.widthMm,
    heightMm: safePaper.heightMm,
  };
}

export function getPaperSizeCssPx(
  paperSizeId: PaperSizeId,
  orientation: PageOrientation = "portrait"
) {
  const size = getPaperSizeMm(paperSizeId, orientation);

  return {
    widthPx: mmToCssPx(size.widthMm),
    heightPx: mmToCssPx(size.heightMm),
  };
}

export function getMarginsCssPx(margins: PageMarginsCm) {
  return {
    topPx: cmToCssPx(margins.topCm),
    rightPx: cmToCssPx(margins.rightCm),
    bottomPx: cmToCssPx(margins.bottomCm),
    leftPx: cmToCssPx(margins.leftCm),
    headerPx: cmToCssPx(margins.headerCm),
    footerPx: cmToCssPx(margins.footerCm),
    gutterPx: cmToCssPx(margins.gutterCm),
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function getPaperById(paperSizeId: string) {
  return PAPER_SIZES.find((paper) => paper.id === paperSizeId);
}

function formatPaperMm(paperSizeId: string) {
  const paper = getPaperById(paperSizeId);

  if (!paper) {
    return "";
  }

  return `${formatNumber(paper.widthMm)} x ${formatNumber(paper.heightMm)} mm`;
}

function getPaperPreviewStyle(paperSizeId: string): CSSProperties {
  const paper = getPaperById(paperSizeId);

  if (!paper) {
    return styles.paperPreview;
  }

  const maxWidth = 18;
  const maxHeight = 26;
  const ratio = paper.widthMm / paper.heightMm;
  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return {
    ...styles.paperPreview,
    width,
    height,
  };
}

function RibbonChevron() {
  return (
    <svg
      width="7"
      height="5"
      viewBox="0 0 7 5"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <path
        d="M1 1.2L3.5 3.7L6 1.2"
        fill="none"
        stroke="#000000"
        strokeWidth="0.9"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function MarginsIcon({
  ink = "#0F0F0F",
  accent = "#D9162F",
  paper = "#FFFFFF",
}: IconTone = {}) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ícone de Margens"
      shapeRendering="geometricPrecision"
    >
      <rect
        x="10.5"
        y="6.5"
        width="43"
        height="51"
        fill={paper}
        stroke={ink}
        strokeWidth="1.8"
      />

      <rect
        x="18.5"
        y="13.5"
        width="27"
        height="37"
        fill={paper}
        stroke={accent}
        strokeWidth="1.15"
      />

      <line x1="18.5" y1="8.5" x2="18.5" y2="12" stroke={accent} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="square" />
      <line x1="12.5" y1="13.5" x2="17" y2="13.5" stroke={accent} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="square" />

      <line x1="45.5" y1="8.5" x2="45.5" y2="12" stroke={accent} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="square" />
      <line x1="47" y1="13.5" x2="51.5" y2="13.5" stroke={accent} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="square" />

      <line x1="12.5" y1="50.5" x2="17" y2="50.5" stroke={accent} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="square" />
      <line x1="18.5" y1="52" x2="18.5" y2="55.5" stroke={accent} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="square" />

      <line x1="47" y1="50.5" x2="51.5" y2="50.5" stroke={accent} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="square" />
      <line x1="45.5" y1="52" x2="45.5" y2="55.5" stroke={accent} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="square" />
    </svg>
  );
}

function OrientationIcon({
  ink = "#0F0F0F",
  accent = "#D9162F",
  paper = "#FFFFFF",
}: IconTone = {}) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ícone de Orientação"
      shapeRendering="geometricPrecision"
    >
      <path
        d="M16.5 8.5H34.5L40.5 14.5V40.5H16.5V8.5Z"
        fill={paper}
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />

      <path
        d="M34.5 8.5V14.5H40.5"
        fill="none"
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />

      <line
        x1="20.5"
        y1="14.5"
        x2="30.5"
        y2="14.5"
        stroke={accent}
        strokeWidth="1.05"
        strokeLinecap="square"
      />

      <path
        d="M24.5 27.5H47.5L53.5 33.5V49.5H24.5V27.5Z"
        fill={paper}
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />

      <path
        d="M47.5 27.5V33.5H53.5"
        fill="none"
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />

      <line
        x1="28.5"
        y1="33.5"
        x2="42.5"
        y2="33.5"
        stroke={accent}
        strokeWidth="1.05"
        strokeLinecap="square"
      />
    </svg>
  );
}

function PaperSizeIcon({
  ink = "#0F0F0F",
  accent = "#D9162F",
  paper = "#FFFFFF",
}: IconTone = {}) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ícone de Tamanho"
      shapeRendering="geometricPrecision"
    >
      <path
        d="M18.5 11.5H39.5L47.5 19.5V52.5H18.5V11.5Z"
        fill={paper}
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />

      <path
        d="M39.5 11.5V19.5H47.5"
        fill="none"
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />

      <line x1="18.5" y1="5.5" x2="47.5" y2="5.5" stroke={accent} strokeWidth="0.9" strokeLinecap="square" />
      <line x1="18.5" y1="5.5" x2="18.5" y2="7.7" stroke={accent} strokeWidth="0.9" strokeLinecap="square" />
      <line x1="47.5" y1="5.5" x2="47.5" y2="7.7" stroke={accent} strokeWidth="0.9" strokeLinecap="square" />

      <line x1="12.5" y1="11.5" x2="12.5" y2="52.5" stroke={accent} strokeWidth="0.9" strokeLinecap="square" />
      <line x1="12.5" y1="11.5" x2="14.7" y2="11.5" stroke={accent} strokeWidth="0.9" strokeLinecap="square" />
      <line x1="12.5" y1="52.5" x2="14.7" y2="52.5" stroke={accent} strokeWidth="0.9" strokeLinecap="square" />
    </svg>
  );
}

function ColumnsIcon({
  ink = "#0F0F0F",
  accent = "#D9162F",
  paper = "#FFFFFF",
}: IconTone = {}) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ícone de Colunas"
      shapeRendering="geometricPrecision"
    >
      <path
        d="M18.5 11.5H39.5L47.5 19.5V52.5H18.5V11.5Z"
        fill={paper}
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />

      <path
        d="M39.5 11.5V19.5H47.5"
        fill="none"
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="miter"
      />

      <line
        x1="33"
        y1="18.5"
        x2="33"
        y2="47.5"
        stroke={accent}
        strokeWidth="0.9"
        strokeLinecap="square"
      />

      <line x1="22.5" y1="23.5" x2="29.5" y2="23.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="22.5" y1="27.5" x2="29.5" y2="27.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="22.5" y1="31.5" x2="29.5" y2="31.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="22.5" y1="35.5" x2="29.5" y2="35.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="22.5" y1="39.5" x2="29.5" y2="39.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />

      <line x1="36.5" y1="23.5" x2="43.5" y2="23.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="36.5" y1="27.5" x2="43.5" y2="27.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="36.5" y1="31.5" x2="43.5" y2="31.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="36.5" y1="35.5" x2="43.5" y2="35.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="36.5" y1="39.5" x2="43.5" y2="39.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
    </svg>
  );
}

function BreaksIcon({
  ink = "#0F0F0F",
  accent = "#D9162F",
}: IconTone = {}) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ícone de Quebras"
      shapeRendering="geometricPrecision"
    >
      <line x1="5" y1="8.5" x2="17" y2="8.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="5" y1="4.5" x2="5" y2="8.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="17" y1="4.5" x2="17" y2="8.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />

      <line
        x1="4.5"
        y1="11"
        x2="17.5"
        y2="11"
        stroke={accent}
        strokeWidth="0.9"
        strokeDasharray="2 1.6"
        strokeLinecap="square"
      />

      <line x1="5" y1="13.5" x2="17" y2="13.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="5" y1="13.5" x2="5" y2="17.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="17" y1="13.5" x2="17" y2="17.5" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
    </svg>
  );
}

function LineNumbersIcon({
  ink = "#0F0F0F",
  accent = "#D9162F",
}: IconTone = {}) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ícone de Números de Linha"
      shapeRendering="geometricPrecision"
    >
      <text x="2.4" y="7.2" fontSize="6.3" fontFamily="Segoe UI, Arial, sans-serif" fontWeight="700" fill={accent}>
        1
      </text>

      <text x="2.4" y="14.9" fontSize="6.3" fontFamily="Segoe UI, Arial, sans-serif" fontWeight="700" fill={accent}>
        2
      </text>

      <line x1="7.8" y1="6.1" x2="17.2" y2="6.1" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="7.8" y1="8.7" x2="14.6" y2="8.7" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="7.8" y1="13.8" x2="17.2" y2="13.8" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
      <line x1="7.8" y1="16.4" x2="14.6" y2="16.4" stroke={ink} strokeWidth="0.95" strokeLinecap="square" />
    </svg>
  );
}

function HyphenationIcon({
  ink = "#0F0F0F",
  accent = "#D9162F",
}: IconTone = {}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 22 22"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ícone de Hifenização"
      shapeRendering="geometricPrecision"
    >
      <text x="2.2" y="8.6" fontSize="7.6" fontFamily="Segoe UI, Arial, sans-serif" fontWeight="700" fill={ink}>
        a
      </text>

      <line x1="8.8" y1="6.8" x2="17" y2="6.8" stroke={accent} strokeWidth="0.9" strokeLinecap="square" />

      <text x="2.2" y="16.4" fontSize="7.6" fontFamily="Segoe UI, Arial, sans-serif" fontWeight="700" fill={ink}>
        b
      </text>

      <line x1="8.8" y1="14.6" x2="17" y2="14.6" stroke={accent} strokeWidth="0.9" strokeLinecap="square" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: "flex",
    alignItems: "flex-start",
    gap: 4,
    height: 68,
    padding: "0 4px 0 4px",
    boxSizing: "border-box",
    overflow: "visible",
  },

  menuHost: {
    position: "relative",
    display: "flex",
    flexShrink: 0,
  },

  largeButton: {
    width: 72,
    height: 64,
    border: "1px solid transparent",
    borderRadius: 4,
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 0,
    cursor: "default",
    fontFamily: "Segoe UI, Arial, sans-serif",
    fontSize: 12,
    color: "#000000",
    padding: "0 2px 0 2px",
    boxSizing: "border-box",
    overflow: "hidden",
    transition: "background 120ms ease, border-color 120ms ease",
  },

  compactStack: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: 0,
    width: 190,
    minWidth: 190,
    marginLeft: 6,
    paddingTop: 2,
    boxSizing: "border-box",
    flexShrink: 0,
    overflow: "visible",
  },

  compactButton: {
    width: 190,
    height: 21,
    border: "1px solid transparent",
    borderRadius: 3,
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    cursor: "default",
    fontFamily: "Segoe UI, Arial, sans-serif",
    fontSize: 12,
    color: "#000000",
    padding: "0 4px",
    boxSizing: "border-box",
    overflow: "hidden",
    transition: "background 120ms ease, border-color 120ms ease",
  },

  ribbonButtonSelected: {
    border: `1px solid ${SELECTOR_BORDER}`,
    background: SELECTOR_BG,
  },

  largeIcon: {
    width: 42,
    height: 39,
    minHeight: 39,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    flexShrink: 0,
    marginTop: -3,
    marginBottom: -1,
    opacity: 1,
    filter: "contrast(1.35) saturate(1.35)",
  },

  compactIcon: {
    width: 29,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "visible",
    opacity: 1,
    filter: "contrast(1.4) saturate(1.35)",
  },

  largeLabel: {
    height: 15,
    lineHeight: "15px",
    whiteSpace: "nowrap",
    fontSize: 12,
    color: "#000000",
    textAlign: "center",
    marginTop: 0,
    marginBottom: 1,
    fontWeight: 400,
  },

  compactLabel: {
    height: 19,
    lineHeight: "19px",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    minWidth: "auto",
    textAlign: "left",
    overflow: "visible",
    textOverflow: "clip",
    color: "#000000",
    fontWeight: 400,
  },

  largeChevron: {
    width: 10,
    height: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    lineHeight: 0,
    flexShrink: 0,
  },

  compactChevron: {
    width: 8,
    height: 19,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
    flexShrink: 0,
    marginLeft: -3,
  },

  menu: {
    position: "fixed",
    zIndex: 999999,
    maxHeight: "calc(100vh - 120px)",
    overflowY: "auto",
    padding: 4,
    border: "1px solid #000000",
    borderRadius: 4,
    background: "#ffffff",
    boxShadow: "0 8px 22px rgba(0, 0, 0, 0.24)",
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },

  paperMenu: {
    width: 286,
    maxHeight: 430,
    overflow: "hidden",
    padding: 0,
    gap: 0,
    borderRadius: 3,
  },

  paperMenuScroll: {
    maxHeight: 398,
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },

  menuItem: {
    width: "100%",
    border: "1px solid transparent",
    borderRadius: 3,
    background: "transparent",
    padding: "5px 8px",
    textAlign: "left",
    fontFamily: "Segoe UI, Arial, sans-serif",
    cursor: "default",
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },

  menuItemText: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },

  menuItemSelected: {
    border: `1px solid ${SELECTOR_BORDER}`,
    background: SELECTOR_BG,
  },

  paperMenuItem: {
    width: "100%",
    minHeight: 42,
    border: "1px solid transparent",
    borderRadius: 0,
    background: "transparent",
    padding: "5px 7px 5px 13px",
    textAlign: "left",
    fontFamily: "Segoe UI, Arial, sans-serif",
    cursor: "default",
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxSizing: "border-box",
  },

  paperMenuItemSelected: {
    border: `1px solid ${SELECTOR_BORDER}`,
    background: SELECTOR_BG,
  },

  paperPreview: {
    width: 13,
    height: 20,
    border: "1px solid #0F0F0F",
    background: "#ffffff",
    boxSizing: "border-box",
    flexShrink: 0,
  },

  paperMenuText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },

  paperMenuItemLabel: {
    fontSize: 11,
    color: "#000000",
    lineHeight: "14px",
    fontWeight: 400,
    whiteSpace: "nowrap",
  },

  paperMenuItemDescription: {
    fontSize: 10.5,
    color: "#000000",
    lineHeight: "13px",
    opacity: 0.9,
    whiteSpace: "nowrap",
    fontWeight: 400,
  },

  paperMoreButton: {
    width: "100%",
    height: 32,
    minHeight: 32,
    border: "1px solid transparent",
    borderTop: "1px solid #c8c8c8",
    borderRadius: 0,
    background: "#ffffff",
    padding: "6px 8px 6px 34px",
    textAlign: "left",
    fontFamily: "Segoe UI, Arial, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    color: "#000000",
    cursor: "default",
    boxSizing: "border-box",
    flexShrink: 0,
  },

  paperMoreButtonSelected: {
    border: `1px solid ${SELECTOR_BORDER}`,
    borderTop: `1px solid ${SELECTOR_BORDER}`,
    background: SELECTOR_BG_STRONG,
  },

  menuItemLabel: {
    fontSize: 12,
    color: "#000000",
    lineHeight: "16px",
    fontWeight: 400,
  },

  menuItemDescription: {
    fontSize: 11,
    color: "#000000",
    lineHeight: "14px",
    opacity: 0.85,
    fontWeight: 400,
  },
};

export default PageSetupGroup;