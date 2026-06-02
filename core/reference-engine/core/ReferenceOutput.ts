import type { ReferenceStyle } from "./ReferenceStyle";
import type { ReferenceType } from "./ReferenceType";

export type ReferenceRenderOutput = {
  sourceId: string;
  style: ReferenceStyle;
  type: ReferenceType;

  formattedReference: string;
  formattedCitation?: string;

  usedFields: string[];
  missingFields: string[];
  warnings: string[];

  confidence: "high" | "medium" | "low";

  richText?: {
    html?: string;
    markdown?: string;
    plainText?: string;
  };
};

