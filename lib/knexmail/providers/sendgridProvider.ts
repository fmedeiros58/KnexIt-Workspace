import type { MailProvider } from "../providerRegistry";
import type { MailSendRequest, MailSendResult } from "../types";

function isConfigured(env: NodeJS.ProcessEnv): boolean {
  return !!env.KNEXMAIL_SENDGRID_API_KEY;
}

async function sendMail(_req: MailSendRequest): Promise<MailSendResult> {
  // TODO: integrar com SendGrid Web API.
  return {
    success: true,
    provider: "sendgrid",
    messageId: `sendgrid-${Date.now()}`,
  };
}

const sendgridProvider: MailProvider = {
  id: "sendgrid",
  displayName: "SendGrid",
  isConfigured,
  sendMail,
};

export default sendgridProvider;
