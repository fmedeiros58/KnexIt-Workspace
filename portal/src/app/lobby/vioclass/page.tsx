import LobbyPage from "../../../components/LobbyPage";

export default function VioClassLobby() {
  return (
    <LobbyPage
      slug="vioclass"
      title="VioClass"
      headline="Plataforma de cursos e aulas em vídeo para organizar trilhas, materiais e avaliação em um único lugar."
      intro="Cria um ambiente completo para publicar conteúdos, gerenciar turmas e acompanhar o progresso com clareza."
      problems={[
        "Centralizar trilhas de aulas e materiais sem depender de ferramentas soltas.",
        "Manter videoaulas, materiais e avaliação no mesmo fluxo.",
        "Acompanhar progresso e engajamento de turmas em tempo real.",
      ]}
      features={[
        "Trilhas de aulas com vídeo, textos e materiais anexados.",
        "Envio de apostilas, slides e atividades direto pelo navegador.",
        "Avaliações e acompanhamento de progresso por turma ou aluno.",
        "Áreas para comentários e interação entre alunos e instrutores.",
        "Relatórios resumidos para coordenação pedagógica.",
      ]}
      audiences={["Professores e tutores", "Coordenação de curso", "Equipes pedagógicas", "Instituições de ensino"]}
    />
  );
}
