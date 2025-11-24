import { getActiveMailProvider } from "./providerRegistry";
import { renderTemplate } from "./templateEngine";
import type { MailSendRequest, MailSendResult, MailTemplate, MailAddress } from "./types";
import { appendLog } from "./store";

export async function sendMailRaw(request: MailSendRequest): Promise<MailSendResult> {
  const provider = getActiveMailProvider(process.env);
  if (!provider) {
    return { success: false, provider: "smtp", error: "Nenhum provider configurado" };
  }
  const result = await provider.sendMail(request);
  appendLog({
    id: `${provider.id}-${Date.now()}`,
    to: request.to.map((a) => a.email).join(", "),
    subject: request.subject,
    status: result.success ? "sent" : "failed",
    provider: provider.id,
    errorMessage: result.error,
    origin: request.origin,
    createdAt: new Date().toISOString(),
  });
  return result;
}

export async function sendMailFromTemplate(options: {
  template: MailTemplate;
  to: MailAddress[];
  variables: Record<string, string>;
  origin?: string;
}): Promise<MailSendResult[]> {
  const payload = renderTemplate(options.template, options.variables);
  const req: MailSendRequest = {
    to: options.to,
    subject: payload.subject,
    bodyHtml: payload.bodyHtml,
    bodyText: payload.bodyText,
    templateId: options.template.id,
    variables: options.variables,
    origin: options.origin,
  };
  const results: MailSendResult[] = [];
  for (const chunk of chunkArray(options.to, 20)) {
    const r = await sendMailRaw({ ...req, to: chunk });
    results.push(r);
  }
  return results;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}
