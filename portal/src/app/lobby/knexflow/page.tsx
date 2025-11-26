import LobbyPage from "../../../components/LobbyPage";

export default function KnexFlowLobby() {
  return (
    <LobbyPage
      slug="knexflow"
      title="KnexFlow"
      headline="Orquestração e automações entre apps da suíte."
      intro="Modele gatilhos e ações integrando aulas, arquivos, IA e comunicação em um só fluxo."
      problems={[
        "Automatizar tarefas entre produtos sem scripts manuais.",
        "Acionar avisos, uploads ou registros a partir de eventos.",
        "Ter rastreabilidade de execuções e fluxos.",
      ]}
      features={[
        "Gatilhos e ações configuráveis entre produtos KnexIT.",
        "Quadros/kanban para visualizar fluxos.",
        "Base para integrações externas futuras.",
      ]}
      audiences={["Operações acadêmicas", "TI/automação", "Times de produto"]}
    />
  );
}
