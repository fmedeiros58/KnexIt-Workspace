import type { TabStopType } from "./rulerTypes";

type RulerCornerBoxProps = {
  sizePx: number;
  heightPx: number;
  tabStopType?: TabStopType;
  onCycleTabStopType?: () => void;
};

function getTabStopLabel(tabStopType: TabStopType) {
  switch (tabStopType) {
    case "center":
      return "Tabulação central";
    case "right":
      return "Tabulação direita";
    case "decimal":
      return "Tabulação decimal";
    case "bar":
      return "Tabulação de barra";
    case "left":
    default:
      return "Tabulação esquerda";
  }
}

function TabStopIcon({ tabStopType }: { tabStopType: TabStopType }) {
  if (tabStopType === "center") {
    return (
      <>
        <path d="M10 6v10" stroke="#2f343a" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5.5 12h9" stroke="#2f343a" strokeWidth="1.5" strokeLinecap="round" />
      </>
    );
  }

  if (tabStopType === "right") {
    return (
      <>
        <path d="M13.5 6v10" stroke="#2f343a" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6.5 12h7" stroke="#2f343a" strokeWidth="1.5" strokeLinecap="round" />
      </>
    );
  }

  if (tabStopType === "decimal") {
    return (
      <>
        <path d="M10 6v8" stroke="#2f343a" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="16.5" r="1.4" fill="#2f343a" />
      </>
    );
  }

  if (tabStopType === "bar") {
    return <path d="M10 5.5v11.5" stroke="#2f343a" strokeWidth="1.8" strokeLinecap="round" />;
  }

  return (
    <>
      <path d="M7 6v10" stroke="#2f343a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 12h7" stroke="#2f343a" strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
}

export function RulerCornerBox({
  sizePx,
  heightPx,
  tabStopType = "left",
  onCycleTabStopType,
}: RulerCornerBoxProps) {
  const title = `${getTabStopLabel(
    tabStopType,
  )}. Clique para alternar o tipo de tabulação`;

  return (
    <button
      type="button"
      onClick={onCycleTabStopType}
      title={title}
      aria-label={title}
      className="sticky left-0 top-0 z-[310] border-r border-[#c9c9c9] bg-[#f7f7f8] p-0"
      style={{ width: sizePx, height: heightPx }}
    >
      <span className="absolute left-2.5 top-[6px] block text-[10px] font-semibold leading-none text-[#5a626d]">
        Tab
      </span>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="absolute left-[16px] top-[9px] h-[18px] w-[18px]"
      >
        <TabStopIcon tabStopType={tabStopType} />
      </svg>
    </button>
  );
}
