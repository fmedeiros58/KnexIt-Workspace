import LobbyPage from "../../../components/LobbyPage";

export default function KnexAiLobby() {
  return (
    <LobbyPage
      slug="knexai"
      title="KnexAI"
      headline="Camada unificada de IA para leitura, revisão, busca e assistentes conectados aos seus dados."
      intro="Ambiente dedicado com streaming, prompts e integrações com Drive, Read, Review e Search."
      problems={[
        "Assistentes de IA espalhados sem controle de uso ou contexto.",
        "Dificuldade de conectar IA aos dados certos (aulas, arquivos, pesquisas).",
        "Falta de padrão para limites e políticas por plano.",
      ]}
      features={[
        "Camada unificada de IA para os apps da suíte.",
        "Assistentes configuráveis com contexto de aulas, arquivos e pesquisas.",
        "Limites e governança alinhados aos planos do Workspace.",
        "Pontos de integração com VioRead, KnexReview e KnexSearch.",
      ]}
      audiences={["Equipes acadêmicas", "Professores e pesquisadores", "Administradores da suíte"]}
    />
  );
}
