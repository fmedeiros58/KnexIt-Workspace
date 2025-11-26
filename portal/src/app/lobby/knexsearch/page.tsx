import LobbyPage from "../../../components/LobbyPage";

export default function KnexSearchLobby() {
  return (
    <LobbyPage
      slug="knexsearch"
      title="KnexSearch"
      headline="Busca unificada no ecossistema KnexIT."
      intro="Encontre aulas, arquivos, docs e conversas em um só lugar, com IA para reformular consultas."
      problems={[
        "Conteúdos espalhados entre aulas, arquivos e chats.",
        "Dificuldade de achar materiais rapidamente.",
        "Resultados pouco relevantes sem contexto.",
      ]}
      features={[
        "Busca federada planejada em Drive, Docs, aulas e chats.",
        "Base para ranking semântico + palavras-chave.",
        "Integração futura com KnexAI para sugestões e reformulação.",
      ]}
      audiences={["Alunos e professores", "Pesquisadores", "Times internos"]}
    />
  );
}
