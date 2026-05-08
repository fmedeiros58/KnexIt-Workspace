import type { ReactNode } from "react";

type WriterRibbonButtonProps = {
  icon?: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
};

export function WriterRibbonButton({ icon, label, active = false, disabled = false, onClick, title }: WriterRibbonButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title || label}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"} disabled:opacity-50`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}



