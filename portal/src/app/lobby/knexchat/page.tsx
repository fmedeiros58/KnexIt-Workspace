import LobbyPage from "../../../components/LobbyPage";

export default function KnexChatLobby() {
  return (
    <LobbyPage
      slug="knexchat"
      title="KnexChat"
      headline="Mensageria/omnichat para turmas e times."
      intro="Centralize conversas, threads e integrações, com apoio de IA para resumo e respostas sugeridas."
      problems={[
        "Conversas dispersas entre apps e canais.",
        "Falta de histórico unificado por turma/projeto.",
        "Dificuldade de acompanhar avisos e threads importantes.",
      ]}
      features={[
        "Canais e threads por turma ou time.",
        "Histórico pesquisável e integrações planejadas com KnexAI.",
        "Base para notificações e automações via KnexFlow.",
      ]}
      audiences={["Turmas e coordenação", "Times internos", "Projetos colaborativos"]}
    />
  );
}
