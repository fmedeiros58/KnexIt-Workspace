import LobbyPage from "../../../components/LobbyPage";

export default function KnexReviewLobby() {
  return (
    <LobbyPage
      slug="knexreview"
      title="KnexReview"
      headline="Revisão sistemática com buscas replicáveis, triagem e extração em um só fluxo."
      intro="Padronize estratégias de busca, triagem e extração de dados com integração a leitura assistida e exportação."
      problems={[
        "Construir estratégia de busca replicável para revisão sistemática.",
        "Deduplicar e triar resultados de várias bases em um fluxo único.",
        "Organizar extração de dados e integração com leitura assistida.",
      ]}
      features={[
        "Construção de estratégias booleanas e registro das buscas.",
        "Execução em múltiplas fontes com adaptadores plugáveis (futuro).",
        "Triagem (screening) com decisões de incluir/excluir.",
        "Extração de dados e sumários para exportar para KnexDocs ou VioRead.",
      ]}
      audiences={["Pesquisadores e labs", "Grupos de revisão sistemática", "Pós-graduandos e orientadores"]}
    />
  );
}
