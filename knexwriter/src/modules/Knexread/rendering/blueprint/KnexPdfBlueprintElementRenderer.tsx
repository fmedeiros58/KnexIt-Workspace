"use client";

import type { CSSProperties } from "react";
import type {
  KnexPdfBlueprintElement,
  KnexPdfFormField,
  KnexPdfImageElement,
  KnexPdfShapeElement,
} from "../../core/KnexPdfBlueprintTypes";
import type { PdfVisualTextRun } from "../text/PdfVisualTextModelBuilder";
import { createPdfTextRunStyle } from "../text/PdfTextCssFactory";

type BlueprintTextElement = PdfVisualTextRun & {
  type?: "text";
  zIndex?: number;
};

export type KnexPdfBlueprintElementRendererProps = {
  element: KnexPdfBlueprintElement;
  interactiveFormFields?: boolean;
};

function getElementBaseStyle(element: {
  x?: number;
  y?: number;
  width: number;
  height: number;
  opacity?: number;
  transform?: string;
  zIndex?: number;
}): CSSProperties {
  return {
    position: "absolute",
    left: `${element.x ?? 0}px`,
    top: `${element.y ?? 0}px`,
    width: `${Math.max(1, element.width)}px`,
    height: `${Math.max(1, element.height)}px`,
    opacity: element.opacity ?? 1,
    transform: element.transform,
    transformOrigin: "0 0",
    zIndex: element.zIndex,
  };
}

function isTextElement(
  element: KnexPdfBlueprintElement,
): element is BlueprintTextElement {
  return (
    (element as { type?: string }).type === "text" ||
    typeof (element as PdfVisualTextRun).text === "string"
  );
}

function isImageElement(
  element: KnexPdfBlueprintElement,
): element is KnexPdfImageElement {
  return (element as { type?: string }).type === "image";
}

function isShapeElement(
  element: KnexPdfBlueprintElement,
): element is KnexPdfShapeElement {
  return (element as { type?: string }).type === "shape";
}

function isFormFieldElement(
  element: KnexPdfBlueprintElement,
): element is KnexPdfFormField {
  return (element as { type?: string }).type === "form-field";
}

function renderTextElement(element: BlueprintTextElement) {
  return (
    <span
      key={element.id}
      data-knexread-blueprint-element="text"
      data-knexread-blueprint-element-id={element.id}
      data-pdf-source-backend={element.sourceBackend}
      data-pdf-confidence={element.confidence}
      data-knexread-blueprint-font-family={element.fontFamily}
      data-knexread-blueprint-font-name={element.fontName ?? ""}
      data-knexread-blueprint-font-size={element.fontSize}
      data-knexread-blueprint-line-height={element.lineHeight}
      data-knexread-blueprint-text-source={element.textSource}
      data-knexread-blueprint-geometry-source={element.geometrySource}
      data-knexread-blueprint-style-source={element.styleSource}
      data-knexread-blueprint-missing-font-family={
        element.missingFontFamily ? "true" : "false"
      }
      data-knexread-blueprint-used-ui-font-family={
        element.usedUiFontFamily ? "true" : "false"
      }
      style={{
        ...createPdfTextRunStyle(element),
        zIndex: element.zIndex ?? 10,
      }}
    >
      {element.text}
    </span>
  );
}

function renderImageElement(element: KnexPdfImageElement) {
  return (
    <img
      key={element.id}
      alt=""
      src={element.src}
      data-knexread-blueprint-element="image"
      data-knexread-blueprint-element-id={element.id}
      draggable={false}
      style={{
        ...getElementBaseStyle(element),
        objectFit: "fill",
        userSelect: "none",
        pointerEvents: "none",
      }}
    />
  );
}

function renderShapeElement(element: KnexPdfShapeElement) {
  const style = getElementBaseStyle(element);
  const stroke = element.stroke;
  const fill = element.fill;

  return (
    <svg
      key={element.id}
      data-knexread-blueprint-element="shape"
      data-knexread-blueprint-element-id={element.id}
      viewBox={`0 0 ${Math.max(1, element.width)} ${Math.max(1, element.height)}`}
      style={{
        ...style,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {element.shapeType === "path" && element.pathData ? (
        <path
          d={element.pathData}
          fill={fill?.color ?? "none"}
          fillOpacity={fill?.opacity ?? 1}
          stroke={stroke?.color ?? "none"}
          strokeWidth={stroke?.width ?? 0}
          strokeOpacity={stroke?.opacity ?? 1}
          strokeDasharray={stroke?.dashArray}
          strokeLinecap={stroke?.lineCap}
          strokeLinejoin={stroke?.lineJoin}
        />
      ) : null}
      {element.shapeType === "rect" ? (
        <rect
          x={0}
          y={0}
          width={Math.max(1, element.width)}
          height={Math.max(1, element.height)}
          fill={fill?.color ?? "none"}
          fillOpacity={fill?.opacity ?? 1}
          stroke={stroke?.color ?? "none"}
          strokeWidth={stroke?.width ?? 0}
          strokeOpacity={stroke?.opacity ?? 1}
          strokeDasharray={stroke?.dashArray}
        />
      ) : null}
      {element.shapeType === "ellipse" || element.shapeType === "circle" ? (
        <ellipse
          cx={Math.max(1, element.width) / 2}
          cy={Math.max(1, element.height) / 2}
          rx={element.radius?.rx ?? Math.max(1, element.width) / 2}
          ry={element.radius?.ry ?? Math.max(1, element.height) / 2}
          fill={fill?.color ?? "none"}
          fillOpacity={fill?.opacity ?? 1}
          stroke={stroke?.color ?? "none"}
          strokeWidth={stroke?.width ?? 0}
          strokeOpacity={stroke?.opacity ?? 1}
          strokeDasharray={stroke?.dashArray}
        />
      ) : null}
      {element.shapeType === "line" ? (
        <line
          x1={0}
          y1={0}
          x2={Math.max(1, element.width)}
          y2={Math.max(1, element.height)}
          stroke={stroke?.color ?? "#111827"}
          strokeWidth={stroke?.width ?? 1}
          strokeOpacity={stroke?.opacity ?? 1}
          strokeDasharray={stroke?.dashArray}
          strokeLinecap={stroke?.lineCap}
        />
      ) : null}
      {(element.shapeType === "polygon" || element.shapeType === "polyline") &&
      element.points ? (
        element.shapeType === "polygon" ? (
          <polygon
            points={element.points.map((point) => point.join(",")).join(" ")}
            fill={fill?.color ?? "none"}
            fillOpacity={fill?.opacity ?? 1}
            stroke={stroke?.color ?? "none"}
            strokeWidth={stroke?.width ?? 0}
            strokeOpacity={stroke?.opacity ?? 1}
          />
        ) : (
          <polyline
            points={element.points.map((point) => point.join(",")).join(" ")}
            fill="none"
            stroke={stroke?.color ?? "#111827"}
            strokeWidth={stroke?.width ?? 1}
            strokeOpacity={stroke?.opacity ?? 1}
          />
        )
      ) : null}
    </svg>
  );
}

function renderFormFieldElement(
  element: KnexPdfFormField,
  interactiveFormFields: boolean,
) {
  const baseStyle: CSSProperties = {
    ...getElementBaseStyle(element),
    fontSize: `${element.fontSize ?? Math.max(10, element.height * 0.55)}px`,
    color: element.fontColor ?? "#111827",
    background: element.backgroundColor ?? "rgba(255, 255, 255, 0.72)",
    border: `${element.border?.width ?? 1}px ${element.border?.style ?? "solid"} ${
      element.border?.color ?? "rgba(17, 24, 39, 0.28)"
    }`,
    boxSizing: "border-box",
    padding: "2px 4px",
    pointerEvents: interactiveFormFields ? "auto" : "none",
  };

  if (element.fieldType === "textarea") {
    return (
      <textarea
        key={element.id}
        data-knexread-blueprint-element="form-field"
        data-knexread-blueprint-element-id={element.id}
        name={element.name}
        defaultValue={element.defaultValue}
        placeholder={element.placeholder}
        readOnly={element.readOnly || !interactiveFormFields}
        required={element.required}
        maxLength={element.maxLength}
        style={baseStyle}
      />
    );
  }

  if (element.fieldType === "select") {
    return (
      <select
        key={element.id}
        data-knexread-blueprint-element="form-field"
        data-knexread-blueprint-element-id={element.id}
        name={element.name}
        defaultValue={element.defaultValue}
        disabled={element.readOnly || !interactiveFormFields}
        required={element.required}
        style={baseStyle}
      >
        {(element.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      key={element.id}
      data-knexread-blueprint-element="form-field"
      data-knexread-blueprint-element-id={element.id}
      type={element.fieldType === "signature" ? "text" : element.fieldType}
      name={element.name}
      defaultValue={element.defaultValue}
      placeholder={element.placeholder}
      readOnly={element.readOnly || !interactiveFormFields}
      required={element.required}
      maxLength={element.maxLength}
      style={baseStyle}
    />
  );
}

export function KnexPdfBlueprintElementRenderer({
  element,
  interactiveFormFields = false,
}: KnexPdfBlueprintElementRendererProps) {
  if (isTextElement(element)) return renderTextElement(element);

  if (isImageElement(element)) return renderImageElement(element);
  if (isShapeElement(element)) return renderShapeElement(element);
  if (isFormFieldElement(element)) {
    return renderFormFieldElement(element, interactiveFormFields);
  }

  return null;
}
