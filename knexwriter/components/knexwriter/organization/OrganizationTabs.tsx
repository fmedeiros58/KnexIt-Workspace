"use client";

import type { OrganizationTab } from "./organizationTypes";
import { ORGANIZATION_TAB_LABEL } from "./organizationTypes";

const PRIMARY_TABS: OrganizationTab[] = ["projects", "sections", "contexts", "references", "structure", "more"];
const MORE_TABS: OrganizationTab[] = ["notes", "revisions", "files", "archived", "trash", "settings"];

export function OrganizationTabs({
  activeTab,
  onChange,
}: {
  activeTab: OrganizationTab;
  onChange: (tab: OrganizationTab) => void;
}) {
  const isMoreActive = activeTab === "more" || MORE_TABS.includes(activeTab);

  return (
    <div className="border-b border-zinc-300 p-2">
      <div className="grid grid-cols-3 gap-1 xl:grid-cols-6">
        {PRIMARY_TABS.map((tab) => {
          const isActive = tab === "more" ? isMoreActive : activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {ORGANIZATION_TAB_LABEL[tab]}
            </button>
          );
        })}
      </div>

      {isMoreActive ? (
        <div className="mt-2 grid grid-cols-2 gap-1">
          {MORE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={`rounded-md border px-2 py-1 text-left text-[11px] font-medium ${
                activeTab === tab
                  ? "border-zinc-900 bg-white text-zinc-900"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-white"
              }`}
            >
              {ORGANIZATION_TAB_LABEL[tab]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
