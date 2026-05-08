import type { LucideIcon } from "lucide-react";
import type { WriterRibbonProps } from "../../shell/KnexWriterShell";

export type RibbonCommandDefinition = {
  id: string;
  label: string;
  icon?: LucideIcon;
  tooltip?: string;
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
};

export type RibbonGroupProps = WriterRibbonProps;

