import type { ReactNode } from "react";

type MasterDetailProps = {
  master: ReactNode;
  detail: ReactNode;
  showDetail?: boolean;
  className?: string;
};

export default function MasterDetail({ master, detail, showDetail = false, className }: MasterDetailProps) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col md:flex-row ${className ?? ""}`.trim()}>
      <div className={`${showDetail ? "hidden md:flex" : "flex"} min-w-0 flex-shrink-0`}>
        {master}
      </div>
      <div className={`${showDetail ? "flex" : "hidden md:flex"} min-w-0 flex-1`}>{detail}</div>
    </div>
  );
}
