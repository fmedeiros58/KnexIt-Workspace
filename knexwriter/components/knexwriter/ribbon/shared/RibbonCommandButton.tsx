import type { RibbonCommandDefinition } from "./ribbonSharedTypes";
import { RibbonCommandIcon } from "./RibbonCommandIcon";

type RibbonCommandButtonProps = {
  command?: RibbonCommandDefinition;
  label?: string;
  tooltip?: string;
  icon?: RibbonCommandDefinition["icon"];
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function RibbonCommandButton(props: RibbonCommandButtonProps) {
  const label = props.command?.label ?? props.label ?? "Comando";
  const tooltip = props.command?.tooltip ?? props.tooltip ?? label;
  const Icon = props.command?.icon ?? props.icon;
  const active = props.command?.active ?? props.active ?? false;
  const disabled = props.command?.disabled ?? props.disabled ?? false;
  const onClick = props.command?.onClick ?? props.onClick;
  const shortcut = props.command?.shortcut ?? props.shortcut;

  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${tooltip} (${shortcut})` : tooltip}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <RibbonCommandIcon icon={Icon} />
      <span>{label}</span>
    </button>
  );
}


