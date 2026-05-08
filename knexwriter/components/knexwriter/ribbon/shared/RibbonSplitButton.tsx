import type { ReactNode } from "react";

type RibbonSplitButtonProps = {
  primary: ReactNode;
  secondary?: ReactNode;
};

export function RibbonSplitButton({ primary, secondary }: RibbonSplitButtonProps) {
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-md border border-zinc-300 bg-white">
      <div className="px-0.5">{primary}</div>
      <div className="w-px bg-zinc-300" />
      <div className="px-0.5">{secondary}</div>
    </div>
  );
}


