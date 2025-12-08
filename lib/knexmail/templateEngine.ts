import type { MailTemplate, MailTemplateFormat } from "./types";

export type RenderedMail = {
  subject: string;
  bodyHtml: string;
  bodyText?: string;
};

const PLACEHOLDER_REGEX = /{{\s*([\w.]+)\s*}}/g;

/**
 * Renderiza assunto e corpo do e-mail substituindo placeholders {{chave}}.
 * Placeholder ausente em `variables` vira string vazia (comportamento consistente).
 * TODO: suportar format === "mjml" compilando MJML -> HTML
 * TODO: suportar format === "react" renderizando componente React Email
 */
export function renderTemplate(template: MailTemplate, variables: Record<string, string>): RenderedMail {
  const format: MailTemplateFormat = template.format ?? "plainHtml";

  // Compat: aceitar bodyHtml ou body legado
  const baseHtml = template.bodyHtml ?? template.body ?? "";
  const baseText = template.bodyTextFallback ?? "";

  const resolve = (text: string) =>
    text.replace(PLACEHOLDER_REGEX, (_match, key: string) => (variables[key] !== undefined ? variables[key] : ""));

  let bodyHtml = baseHtml;
  if (format === "plainHtml") {
    bodyHtml = resolve(baseHtml);
  }
  // format === "mjml" ou "react" ficaria aqui no futuro

  const subject = resolve(template.subject);
  const bodyText = baseText ? resolve(baseText) : toPlainText(bodyHtml);

  return { subject, bodyHtml, bodyText };
}

/**
 * Extrai variáveis usadas no template (subject, bodyHtml, bodyTextFallback).
 */
export function extractVariablesFromTemplate(template: MailTemplate): string[] {
  const parts = [template.subject, template.bodyHtml ?? "", template.bodyTextFallback ?? template.body ?? ""];
  const found = new Set<string>();

  for (const part of parts) {
    for (const match of part.matchAll(PLACEHOLDER_REGEX)) {
      const key = match[1];
      if (key) found.add(key);
    }
  }

  return Array.from(found);
}

/**
 * Valida variáveis: o que falta e o que sobrou.
 */
export function validateTemplateVariables(template: MailTemplate, provided: Record<string, string>): {
  missing: string[];
  unused: string[];
} {
  const required = extractVariablesFromTemplate(template);
  const missing = required.filter((key) => !(key in provided));
  const unused = Object.keys(provided).filter((key) => !required.includes(key));
  return { missing, unused };
}

/**
 * Converte HTML em texto simples para fallback de e-mail.
 */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
