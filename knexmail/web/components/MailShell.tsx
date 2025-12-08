"use client";

import type { ReactNode } from "react";

type Section = "dashboard" | "templates" | "campaigns" | "logs";

type Props = {
  section: Section;
  onSectionChange: (s: Section) => void;
  content: ReactNode;
};

export default function MailShell({ section, onSectionChange, content }: Props) {
  const sections: { id: Section; label: string }[] = [
    { id: "dashboard", label: "Resumo / Dashboard" },
    { id: "templates", label: "Templates" },
    { id: "campaigns", label: "Campanhas" },
    { id: "logs", label: "Logs de envio" },
  ];
  return (
    <div className="grid min-h-screen grid-cols-[240px_minmax(0,1fr)] bg-white">
      <aside className="border-r border-slate-200 bg-slate-50/70">
        <div className="p-4 space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">KnexMail</h2>
          <p className="text-xs text-slate-600">E-mails transacionais e campanhas.</p>
        </div>
        <nav className="px-3 pb-4 space-y-1 text-sm">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`w-full text-left px-3 py-2 rounded-lg ${
                section === s.id ? "bg-indigo-100 text-indigo-800" : "hover:bg-slate-100 text-slate-700"
              }`}
              onClick={() => onSectionChange(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="min-h-screen">
        <header className="border-b border-slate-200 px-6 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">KnexMail</p>
          <h1 className="text-xl font-semibold text-slate-900">{sections.find((s) => s.id === section)?.label}</h1>
        </header>
        <div className="p-6">{content}</div>
      </main>
    </div>
  );
}

