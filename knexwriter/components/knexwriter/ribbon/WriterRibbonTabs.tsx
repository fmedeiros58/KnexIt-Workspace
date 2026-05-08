import type { WriterHeaderTab } from "../state/writerTypes";

type WriterRibbonTabsProps = {
  tabs: Array<{ value: WriterHeaderTab; label: string }>;
  activeTab: WriterHeaderTab;
  onChange: (tab: WriterHeaderTab) => void;
};

export function WriterRibbonTabs({ tabs, activeTab, onChange }: WriterRibbonTabsProps) {
  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`rounded px-2 py-1 text-xs ${activeTab === tab.value ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200"}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}



