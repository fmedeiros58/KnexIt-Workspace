import type { MailProviderId, MailSendRequest, MailSendResult } from "./types";
import smtpProvider from "./providers/smtpProvider";
import sendgridProvider from "./providers/sendgridProvider";
import sesProvider from "./providers/sesProvider";

export interface MailProvider {
  id: MailProviderId;
  displayName: string;
  isConfigured: (env: NodeJS.ProcessEnv) => boolean;
  sendMail: (req: MailSendRequest) => Promise<MailSendResult>;
}

const ALL_PROVIDERS = [smtpProvider, sendgridProvider, sesProvider];

export function getAllMailProviders(): MailProvider[] {
  return ALL_PROVIDERS;
}

export function getActiveMailProvider(env: NodeJS.ProcessEnv): MailProvider | null {
  const configured = ALL_PROVIDERS.find((p) => p.isConfigured(env));
  return configured || null;
}

