import type { MailProvider } from "../providerRegistry";
import type { MailSendRequest, MailSendResult } from "../types";

function isConfigured(env: NodeJS.ProcessEnv): boolean {
  return !!(env.KNEXMAIL_SES_ACCESS_KEY && env.KNEXMAIL_SES_SECRET && env.KNEXMAIL_SES_REGION);
}

async function sendMail(_req: MailSendRequest): Promise<MailSendResult> {
  // TODO: integrar com AWS SES (SDK v3).
  return {
    success: true,
    provider: "ses",
    messageId: `ses-${Date.now()}`,
  };
}

const sesProvider: MailProvider = {
  id: "ses",
  displayName: "AWS SES",
  isConfigured,
  sendMail,
};

export default sesProvider;
