import BrandingPage from "../../knexmail/components/BrandingPage";

const EMAIL_APPS = ["VioLive", "VioClass", "SupaDrive", "KnexAI", "KnexDocs", "KnexFlow"];

export default function KnexMailBranding() {
  return (
    <BrandingPage
      slug="knexmail"
      chips={EMAIL_APPS}
      heroTitle="KnexMail: e-mails e campanhas que falam com toda a suíte"
      heroDescription="Envie lembretes, comunicados e convites em massa com templates inteligentes, integração a lives, aulas e fluxos de trabalho."
      featureCards={[
        { title: "Templates inteligentes", body: "Padronize avisos de aula, lembretes de live e comunicados institucionais com variáveis e personalização." },
        { title: "Envios transacionais e campanhas", body: "Dispare confirmações, convites e avisos em massa para turmas, listas ou segmentos específicos." },
        { title: "Providers plugáveis", body: "SMTP, SendGrid ou SES. Escolha o provedor e troque depois sem reescrever a lógica de envio." },
        { title: "Logs e rastreabilidade", body: "Veja status de entrega, falhas e histórico para comprovar disparos importantes." },
      ]}
      benefits={[
        "Lembretes de VioLive e novas aulas do VioClass enviados automaticamente.",
        "Modelos reutilizáveis para avisos acadêmicos, provas e comunicados de secretaria.",
        "Placeholders para personalizar nome, curso, datas e links sem perder consistência.",
        "Fácil de integrar com fluxos do KnexFlow e arquivos do SupaDrive.",
      ]}
      demo={{
        title: "Template: Lembrete de VioLive",
        statusLabel: "Automatizado",
        statusTone: "green",
        sections: [
          { title: "Assunto", lines: ["Lembrete: sessão {{titulo_sessao}} hoje às {{horario}}"] },
          { title: "Corpo", lines: ["Olá {{nome}},", "sua VioLive {{titulo_sessao}} começa em breve. Acesse: {{link}}."] },
          { title: "Status e logs", lines: ["Entregues: 98% · Falhas: 2% · Provider: SMTP"] },
        ],
      }}
    />
  );
}

