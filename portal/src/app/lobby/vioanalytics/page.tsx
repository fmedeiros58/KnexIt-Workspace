import LobbyPage from "../../../components/LobbyPage";

export default function VioAnalyticsLobby() {
  return (
    <LobbyPage
      slug="vioanalytics"
      title="VioAnalytics"
      headline="Métricas e insights das soluções Vio/KnexIT."
      intro="Monitore engajamento de aulas, lives e materiais, preparando painéis e KPIs unificados."
      problems={[
        "Consolidar métricas de aulas, lives e arquivos em um só lugar.",
        "Entender engajamento de turmas e conteúdos.",
        "Extrair KPIs para relatórios acadêmicos e operacionais.",
      ]}
      features={[
        "Colete eventos de visualização, participação e downloads.",
        "Dashboards de engajamento por turma, curso e período.",
        "Base para exportar relatórios e alimentar BI externo.",
      ]}
      audiences={["Coordenação acadêmica", "Equipes pedagógicas", "Times de dados/BI"]}
    />
  );
}
