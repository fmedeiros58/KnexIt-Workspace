import type { LucideIcon } from "lucide-react";

type RibbonCommandIconProps = {
  icon?: LucideIcon;
  className?: string;
};

export function RibbonCommandIcon({ icon: Icon, className }: RibbonCommandIconProps) {
  if (!Icon) return null;
  return <Icon size={14} className={className} aria-hidden="true" />;
}


