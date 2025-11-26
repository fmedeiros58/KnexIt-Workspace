import LobbyPage from "../../../components/LobbyPage";

export default function VioReadLobby() {
  return (
    <LobbyPage
      slug="vioread"
      title="VioRead"
      headline="Leitura inteligente de PDFs e artigos, com tradução e apoio de IA para estudo."
      intro="Reforce o estudo com traduções, resumos e fichamentos mantendo a estrutura original dos documentos."
      problems={[
        "Ler artigos e PDFs longos sem apoio para tradução ou resumo.",
        "Manter estrutura do documento ao traduzir para outro idioma.",
        "Reaproveitar trechos para fichamentos e materiais de aula.",
      ]}
      features={[
        "Leitura assistida preservando títulos, seções e listas.",
        "Tradução com estrutura mantida e opção lado a lado.",
        "Selecione trechos para pedir explicação, resumo ou fichamento.",
        "Exportação futura para KnexDocs, VioClass ou SupaDrive.",
      ]}
      audiences={["Alunos e pesquisadores", "Professores e orientadores", "Grupos de estudo e labs"]}
    />
  );
}
