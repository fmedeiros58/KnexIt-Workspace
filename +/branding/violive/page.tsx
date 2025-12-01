import BrandingPage from "../../violive/components/BrandingPage";

export default function VioLiveBranding() {
  return (
    <BrandingPage
      slug="violive"
      heroTitle="VioLive: aulas e mentorias ao vivo"
      heroDescription="Salas ao vivo com agendamento, gravação e integração ao ecossistema."
      featureCards={[
        { title: "Links por turma", body: "Agendas visíveis para alunos e instrutores." },
        { title: "Gravação integrada", body: "Republique no VioClass ou SupaDrive." },
        { title: "Chat e interação", body: "Engaje durante a sessão." },
        { title: "Convites e lembretes", body: "Integração planejada com KnexMail." },
      ]}
      benefits={[
        "Centralização de encontros síncronos.",
        "Replays fáceis de publicar.",
        "Menos dependência de ferramentas externas.",
      ]}
    />
  );
}

