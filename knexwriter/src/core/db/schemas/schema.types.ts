export interface FieldSchema {
  name: string;
  type: string;
  nullable?: boolean;
  indexed?: boolean;
  unique?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface EntitySchema {
  name: string;
  tableName: string;
  fields: FieldSchema[];
  indexes?: Array<{ name: string; fields: string[]; unique?: boolean }>;
}

