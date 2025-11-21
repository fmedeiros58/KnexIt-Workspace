"use client";
import React from "react";

export default function SidebarFrame({
  title, children,
}: { title: string; children: React.ReactNode }) {
  return (
    <div className="fixed top-24 bottom-6 right-4 z-40 w-[360px] max-w-[85vw] rounded-xl bg-white shadow-2xl ring-1 ring-slate-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-4 overflow-auto h-[calc(100%-48px)]">{children}</div>
    </div>
  );
}
