import BrandingPage from "../../knexchat/components/BrandingPage";

export default function KnexChatBranding() {
  return (
    <BrandingPage
      slug="knexchat"
      heroTitle="KnexChat: mensageria/omnichat"
      heroDescription="Centralize conversas, threads e notificações com apoio de IA."
      featureCards={[
        { title: "Canais e threads", body: "Organize por turma, time ou projeto." },
        { title: "Histórico pesquisável", body: "Busque mensagens e anexos rapidamente." },
        { title: "Integração com KnexAI", body: "Resumos e respostas sugeridas (futuro)." },
        { title: "Notificações e fluxos", body: "Base para alertas e automações via KnexFlow." },
      ]}
      benefits={[
        "Menos dispersão de comunicação entre apps.",
        "Contexto centralizado por turma ou tema.",
        "Preparado para IA assistiva e integrações.",
      ]}
    />
  );
}

