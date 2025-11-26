import LobbyPage from "../../../components/LobbyPage";

export default function VioLiveLobby() {
  return (
    <LobbyPage
      slug="violive"
      title="VioLive"
      headline="Salas ao vivo para aulas, mentorias e reuniões integradas ao KnexIT Workspace."
      intro="Centraliza encontros síncronos com agendamento, links e gravações em um fluxo único."
      problems={[
        "Reunir aulas e mentorias ao vivo com links organizados por turma.",
        "Enviar convites e lembretes sem depender de várias ferramentas.",
        "Integrar lives com gravações e materiais para alunos que perderam a sessão.",
      ]}
      features={[
        "Salas ao vivo com compartilhamento de tela e câmera.",
        "Links por turma e agendas visíveis para alunos e instrutores.",
        "Gravação integrada para republicar no VioClass ou SupaDrive.",
        "Chat e interação leve durante a sessão.",
        "Suporte a lembretes e convites via KnexMail (quando configurado).",
      ]}
      audiences={["Professores e mentores", "Coordenação de cursos", "Turmas que precisam de encontros síncronos"]}
    />
  );
}
