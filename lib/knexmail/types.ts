export type MailProviderId = "smtp" | "sendgrid" | "ses";

export type MailTemplateId = string;
export type MailTemplateFormat = "plainHtml" | "mjml" | "react";

export type MailAddress = {
  name?: string;
  email: string;
};

export type MailTemplate = {
  id: MailTemplateId;
  name: string;
  description?: string;
  subject: string;
  bodyHtml: string;
  bodyTextFallback?: string;
  variables?: string[];
  format?: MailTemplateFormat; // TODO: suportar "mjml" ou "react" compilando antes do envio
  // Compatibilidade com versões antigas
  body?: string;
  updatedAt?: string;
};

export type MailCampaign = {
  id: string;
  name: string;
  templateId: string;
  targetType: "list" | "segment" | "manual";
  targetConfig: any;
  status: "draft" | "ready" | "sent" | "scheduled";
  scheduledAt?: string;
};

export type MailLog = {
  id: string;
  to: string;
  subject: string;
  status: "sent" | "failed" | "queued";
  provider: MailProviderId;
  errorMessage?: string;
  origin?: string;
  createdAt: string;
};

export type MailSendRequest = {
  to: MailAddress[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  templateId?: string;
  variables?: Record<string, string>;
  origin?: string;
};

export type MailSendResult = {
  success: boolean;
  provider: MailProviderId;
  messageId?: string;
  error?: string;
};
