import type { MailProvider } from "../providerRegistry";
import type { MailSendRequest, MailSendResult } from "../types";

function isConfigured(env: NodeJS.ProcessEnv): boolean {
  return !!(env.KNEXMAIL_SMTP_HOST && env.KNEXMAIL_SMTP_PORT && env.KNEXMAIL_SMTP_USER && env.KNEXMAIL_SMTP_PASS);
}

async function sendMail(req: MailSendRequest): Promise<MailSendResult> {
  // TODO: integrar com biblioteca SMTP (ex: nodemailer). Aqui, mock:
  return {
    success: true,
    provider: "smtp",
    messageId: `smtp-${Date.now()}`,
  };
}

const smtpProvider: MailProvider = {
  id: "smtp",
  displayName: "SMTP",
  isConfigured,
  sendMail,
};

export default smtpProvider;
