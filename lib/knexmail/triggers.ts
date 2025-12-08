import { sendMailFromTemplate } from "./mailer";
import { getTemplateById } from "./store";
import type { MailAddress, MailSendResult, MailTemplate, MailTemplateId } from "./types";

export type MailOrigin = "knexmail_manual" | "vio_class" | "vio_live" | "knexreview" | "system";

export const TEMPLATE_IDS = {
  CLASS_ENROLLMENT: "class_enrollment",
  NEW_LESSON: "new_lesson_notification",
  LIVE_REMINDER: "live_session_reminder",
  REVIEW_READY: "review_ready",
  SYSTEM_ALERT: "system_alert",
} as const;

export interface ClassEnrollmentParams {
  to: MailAddress;
  studentName: string;
  courseName: string;
  classUrl: string;
  startDate?: string;
}

export interface NewLessonNotificationParams {
  to: MailAddress;
  studentName: string;
  courseName: string;
  lessonTitle: string;
  lessonUrl: string;
}

export interface LiveSessionReminderParams {
  to: MailAddress;
  studentName?: string;
  sessionTitle: string;
  sessionDateTime: string;
  sessionUrl: string;
}

export interface ReviewReadyParams {
  to: MailAddress;
  reviewerName?: string;
  reviewTitle: string;
  reviewUrl: string;
}

export interface GenericSystemAlertParams {
  to: MailAddress;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

async function loadTemplateById(id: MailTemplateId): Promise<MailTemplate> {
  // Primeiro tenta buscar do store (futuramente Supabase/DB)
  const stored = getTemplateById(id);
  if (stored) return stored;

  // Fallback mockado para desenvolvimento; trocar por fetch no DB
  switch (id) {
    case TEMPLATE_IDS.CLASS_ENROLLMENT:
      return {
        id,
        name: "Matricula confirmada",
        subject: "Voce entrou em {{curso}}",
        bodyHtml:
          "<p>Ola {{nome}},</p><p>Sua matricula em <strong>{{curso}}</strong> foi confirmada. Acesse: <a href=\"{{url_turma}}\">abrir turma</a>.</p><p>Inicio: {{data_inicio}}</p>",
        bodyTextFallback: "Ola {{nome}}, sua matricula em {{curso}} foi confirmada. Link: {{url_turma}}. Inicio: {{data_inicio}}",
        variables: ["nome", "curso", "url_turma", "data_inicio"],
      };
    case TEMPLATE_IDS.NEW_LESSON:
      return {
        id,
        name: "Nova aula liberada",
        subject: "Nova aula em {{curso}}: {{titulo_aula}}",
        bodyHtml:
          "<p>Ola {{nome}},</p><p>A aula <strong>{{titulo_aula}}</strong> esta disponivel em {{curso}}.</p><p>Veja em: <a href=\"{{url_aula}}\">abrir aula</a>.</p>",
        bodyTextFallback: "Ola {{nome}}, a aula {{titulo_aula}} esta disponivel. Acesse: {{url_aula}}",
        variables: ["nome", "curso", "titulo_aula", "url_aula"],
      };
    case TEMPLATE_IDS.LIVE_REMINDER:
      return {
        id,
        name: "Lembrete de sessao ao vivo",
        subject: "Lembrete: {{titulo_sessao}} em {{data_hora}}",
        bodyHtml:
          "<p>{{nome}},</p><p>Lembrete da sessao <strong>{{titulo_sessao}}</strong> em {{data_hora}}.</p><p>Entre pelo link: <a href=\"{{url_sessao}}\">acessar ao vivo</a>.</p>",
        bodyTextFallback: "Lembrete: {{titulo_sessao}} em {{data_hora}}. Link: {{url_sessao}}",
        variables: ["nome", "titulo_sessao", "data_hora", "url_sessao"],
      };
    case TEMPLATE_IDS.REVIEW_READY:
      return {
        id,
        name: "Revisao pronta",
        subject: "Sua revisao {{titulo_revisao}} esta pronta",
        bodyHtml:
          "<p>Ola {{nome}},</p><p>A revisao <strong>{{titulo_revisao}}</strong> esta pronta para consulta.</p><p>Acesse: <a href=\"{{url_revisao}}\">abrir revisao</a>.</p>",
        bodyTextFallback: "A revisao {{titulo_revisao}} esta pronta. Link: {{url_revisao}}",
        variables: ["nome", "titulo_revisao", "url_revisao"],
      };
    case TEMPLATE_IDS.SYSTEM_ALERT:
      return {
        id,
        name: "Alerta do sistema",
        subject: "{{titulo}}",
        bodyHtml: "<p>{{mensagem}}</p><p><a href=\"{{action_url}}\">{{action_label}}</a></p>",
        bodyTextFallback: "{{mensagem}} {{action_url}}",
        variables: ["titulo", "mensagem", "action_url", "action_label"],
      };
    default:
      throw new Error(`Template ${id} nao encontrado`);
  }
}

// ------- TRIGGERS -------

/** Envio quando aluno se matricula em um curso (VioClass). */
export async function sendClassEnrollmentEmail(params: ClassEnrollmentParams): Promise<MailSendResult[]> {
  const template = await loadTemplateById(TEMPLATE_IDS.CLASS_ENROLLMENT);
  const vars = {
    nome: params.studentName,
    curso: params.courseName,
    url_turma: params.classUrl,
    data_inicio: params.startDate ?? "",
  };
  return sendMailFromTemplate({ template, to: [params.to], variables: vars, origin: "vio_class" });
}

/** Envio quando nova aula fica disponivel (VioClass). */
export async function sendNewLessonNotification(params: NewLessonNotificationParams): Promise<MailSendResult[]> {
  const template = await loadTemplateById(TEMPLATE_IDS.NEW_LESSON);
  const vars = {
    nome: params.studentName,
    curso: params.courseName,
    titulo_aula: params.lessonTitle,
    url_aula: params.lessonUrl,
  };
  return sendMailFromTemplate({ template, to: [params.to], variables: vars, origin: "vio_class" });
}

/** Lembrete de sessao ao vivo (VioLive). */
export async function sendLiveSessionReminder(params: LiveSessionReminderParams): Promise<MailSendResult[]> {
  const template = await loadTemplateById(TEMPLATE_IDS.LIVE_REMINDER);
  const vars = {
    nome: params.studentName ?? "",
    titulo_sessao: params.sessionTitle,
    data_hora: params.sessionDateTime,
    url_sessao: params.sessionUrl,
  };
  return sendMailFromTemplate({ template, to: [params.to], variables: vars, origin: "vio_live" });
}

/** Aviso de revisao ou sintese pronta (KnexReview). */
export async function sendReviewReadyEmail(params: ReviewReadyParams): Promise<MailSendResult[]> {
  const template = await loadTemplateById(TEMPLATE_IDS.REVIEW_READY);
  const vars = {
    nome: params.reviewerName ?? "",
    titulo_revisao: params.reviewTitle,
    url_revisao: params.reviewUrl,
  };
  return sendMailFromTemplate({ template, to: [params.to], variables: vars, origin: "knexreview" });
}

/** Alerta generico do sistema (administrativo). */
export async function sendGenericSystemAlert(params: GenericSystemAlertParams): Promise<MailSendResult[]> {
  const template = await loadTemplateById(TEMPLATE_IDS.SYSTEM_ALERT);
  const vars = {
    titulo: params.title,
    mensagem: params.message,
    action_url: params.actionUrl ?? "",
    action_label: params.actionLabel ?? "Acessar",
  };
  return sendMailFromTemplate({ template, to: [params.to], variables: vars, origin: "system" });
}
