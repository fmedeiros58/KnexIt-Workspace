import type { HTMLAttributes, ReactNode } from "react";

type RibbonTabLayoutProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function RibbonTabLayout({ children, className = "", ...rest }: RibbonTabLayoutProps) {
  return (
    <div {...rest} className={`border-b border-zinc-300 bg-[#f4f4f5] px-2 py-2 sm:px-3 ${className}`.trim()}>
      <div className="overflow-x-auto overflow-y-hidden">
        <div className="flex min-w-max items-stretch gap-2 pb-1">{children}</div>
      </div>
    </div>
  );
}

export default RibbonTabLayout;
