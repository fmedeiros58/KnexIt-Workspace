import LobbyPage from "../../../components/LobbyPage";

const EMAIL_APPS = ["VioLive", "VioClass", "SupaDrive", "KnexAI", "KnexDocs", "KnexFlow"];

export default function KnexMailLobby() {
  return (
    <LobbyPage
      slug="knexmail"
      title="KnexMail"
      chips={EMAIL_APPS}
      headline="E-mails e campanhas integrados ao ecossistema."
      intro="Envie lembretes, comunicados e convites em massa com templates inteligentes e integrações planejadas com aulas, lives e fluxos."
      problems={[
        "Enviar lembretes e comunicados de forma padronizada.",
        "Personalizar envios por turma/curso sem perder consistência.",
        "Integrar disparos a fluxos e eventos do Workspace.",
      ]}
      features={[
        "Templates inteligentes com variáveis para aulas e lives.",
        "Envios transacionais e campanhas em massa.",
        "Providers plugáveis (SMTP/SendGrid/SES).",
        "Logs e rastreabilidade de entregas.",
      ]}
      audiences={["Coordenação e secretaria", "Equipes de comunicação", "Operações acadêmicas"]}
    />
  );
}
