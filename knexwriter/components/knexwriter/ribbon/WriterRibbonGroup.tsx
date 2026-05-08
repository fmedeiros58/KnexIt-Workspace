import type { ReactNode } from "react";

type WriterRibbonGroupProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function WriterRibbonGroup({ title, children, className = "" }: WriterRibbonGroupProps) {
  return (
    <section
      className={`flex h-full min-w-[108px] shrink-0 flex-col justify-between border-r border-zinc-300 px-1.5 py-1 sm:min-w-[120px] sm:px-2 ${className}`.trim()}
    >
      <div className="flex flex-1 items-center gap-1">{children}</div>
      <p className="pt-1 text-center text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:text-[10px]">
        {title}
      </p>
    </section>
  );
}



