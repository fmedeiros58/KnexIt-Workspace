import type { MailTemplate, MailCampaign, MailLog, MailTemplateId } from "./types";

// In-memory store (substituir por Supabase/DB)
const templates: MailTemplate[] = [
  {
    id: "tmpl-1",
    name: "Lembrete de aula",
    description: "Notifica alunos sobre nova aula",
    subject: "Nova aula: {{titulo_aula}}",
    bodyHtml: "<p>Ola {{nome}},</p><p>A nova aula <strong>{{titulo_aula}}</strong> esta disponivel em {{data}}.</p>",
    bodyTextFallback: "Ola {{nome}}, a nova aula {{titulo_aula}} esta disponivel em {{data}}.",
    variables: ["nome", "titulo_aula", "data"],
    updatedAt: new Date().toISOString(),
  },
];

const campaigns: MailCampaign[] = [
  { id: "cmp-1", name: "Aviso turma X", templateId: "tmpl-1", targetType: "list", targetConfig: {}, status: "draft" },
];

const logs: MailLog[] = [];

export function listTemplates() {
  return templates;
}

export function saveTemplate(t: MailTemplate) {
  const idx = templates.findIndex((x) => x.id === t.id);
  if (idx >= 0) templates[idx] = t;
  else templates.push(t);
  return t;
}

export function listCampaigns() {
  return campaigns;
}

export function saveCampaign(c: MailCampaign) {
  const idx = campaigns.findIndex((x) => x.id === c.id);
  if (idx >= 0) campaigns[idx] = c;
  else campaigns.push(c);
  return c;
}

export function listLogs() {
  return logs.slice(-200);
}

export function appendLog(log: MailLog) {
  logs.push(log);
}

export function getTemplateById(id: MailTemplateId) {
  return templates.find((t) => t.id === id) || null;
}
