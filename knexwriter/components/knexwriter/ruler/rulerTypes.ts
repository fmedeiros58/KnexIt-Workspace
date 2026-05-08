export type RulerUnit = "cm" | "mm" | "in" | "px";

export type PageFormat = "a4" | "letter" | "custom";

export type PageOrientation = "portrait" | "landscape";

export type PageSize = {
  format: PageFormat;
  orientation: PageOrientation;
  widthCm: number;
  heightCm: number;
  widthPx: number;
  heightPx: number;
};

export type PageMargins = {
  topPx: number;
  rightPx: number;
  bottomPx: number;
  leftPx: number;
};

export type PageMarginsCm = {
  topCm: number;
  rightCm: number;
  bottomCm: number;
  leftCm: number;
};

export type ParagraphIndents = {
  leftPx: number;
  rightPx: number;
  firstLinePx: number;
  hangingPx: number;
};

export type TabStopType = "left" | "center" | "right" | "decimal" | "bar";

export type TabStop = {
  id: string;
  positionPx: number;
  type: TabStopType;
};

export type RulerSettings = {
  unit: RulerUnit;
  zoom: number;
  showRuler: boolean;
  showMargins: boolean;
  showPrintableArea: boolean;
  showIndentMarkers: boolean;
  showTabStops: boolean;
};

export type RulerDragMode =
  | "none"
  | "margin-left"
  | "margin-right"
  | "margin-top"
  | "margin-bottom"
  | "indent-left"
  | "indent-right"
  | "indent-first-line"
  | "indent-hanging"
  | "tab-stop";

