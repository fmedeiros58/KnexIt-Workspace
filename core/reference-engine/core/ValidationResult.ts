export type ValidationResult = {
  canRender: boolean;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
  warnings: string[];
  confidence: "high" | "medium" | "low";
};

