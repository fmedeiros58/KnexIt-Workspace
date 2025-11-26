import LobbyPage from "../../../components/LobbyPage";

export default function KnexDocsLobby() {
  return (
    <LobbyPage
      slug="knexdocs"
      title="KnexDocs"
      headline="Documentos colaborativos conectados ao ecossistema KnexIT."
      intro="Crie, edite e versionize docs em tempo real, integrando com SupaDrive, KnexAI e VioRead."
      problems={[
        "Criar documentos colaborativos sem perder histórico.",
        "Organizar pautas, atas e materiais com o time em um só lugar.",
        "Evitar cópias isoladas e documentos dispersos em vários apps.",
      ]}
      features={[
        "Edição colaborativa em tempo real.",
        "Versões e comentários em um só fluxo.",
        "Integração planejada com SupaDrive, KnexAI e VioRead.",
      ]}
      audiences={["Times acadêmicos", "Projetos colaborativos", "Coordenação e secretaria"]}
    />
  );
}
