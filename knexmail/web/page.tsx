"use client";

import { useMemo, useState } from "react";
import MailShell from "./components/MailShell";
import MailDashboard from "./components/MailDashboard";
import TemplateList from "./components/TemplateList";
import TemplateEditor from "./components/TemplateEditor";
import CampaignList from "./components/CampaignList";
import CampaignEditor from "./components/CampaignEditor";
import MailLogsTable from "./components/MailLogsTable";
import { useTemplates } from "./hooks/useTemplates";
import { useCampaigns } from "./hooks/useCampaigns";
import { useMailLogs } from "./hooks/useMailLogs";
import { useKnexMailEnv } from "./hooks/useKnexMailEnv";
import type { MailTemplate, MailCampaign } from "@/lib/knexmail/types";

type Section = "dashboard" | "templates" | "campaigns" | "logs";

export default function KnexMailPage() {
  const [section, setSection] = useState<Section>("dashboard");
  const { templates, save: saveTemplate } = useTemplates();
  const { campaigns, save: saveCampaign } = useCampaigns();
  const { logs } = useMailLogs();
  const envStatus = useKnexMailEnv();

  const [activeTemplate, setActiveTemplate] = useState<MailTemplate | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<MailCampaign | null>(null);

  const content = useMemo(() => {
    if (section === "dashboard") {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            Provider ativo: {envStatus.provider || "nenhum"} • Configurado: {envStatus.configured ? "sim" : "não"}
          </div>
          <MailDashboard
            stats={{
              todaySent: logs.filter((l) => isToday(l.createdAt)).length,
              monthSent: logs.filter((l) => isThisMonth(l.createdAt)).length,
              successRate: logs.length ? logs.filter((l) => l.status === "sent").length / logs.length : 0,
              byOrigin: aggregateOrigins(logs),
            }}
          />
        </div>
      );
    }
    if (section === "templates") {
      return (
        <div className="space-y-4">
          <TemplateList templates={templates} onSelect={(t) => setActiveTemplate(t)} />
          <TemplateEditor template={activeTemplate} onSave={saveTemplate} />
        </div>
      );
    }
    if (section === "campaigns") {
      return (
        <div className="space-y-4">
          <CampaignList campaigns={campaigns} templates={templates} onSelect={(c) => setActiveCampaign(c)} />
          <CampaignEditor campaign={activeCampaign} templates={templates} onSave={saveCampaign} />
        </div>
      );
    }
    return <MailLogsTable logs={logs} />;
  }, [section, envStatus, logs, templates, campaigns, activeTemplate, activeCampaign, saveTemplate, saveCampaign]);

  return <MailShell section={section} onSectionChange={setSection} content={content} />;
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}
function isThisMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function aggregateOrigins(logs: { origin?: string }[]) {
  const map = new Map<string, number>();
  logs.forEach((l) => {
    const key = l.origin || "manual";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}
