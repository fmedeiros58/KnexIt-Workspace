import SolutionLayout from "../_components/SolutionLayout";

export default function EducacaoPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Educação"
      subtitle="Soluções para ensino, pesquisa e gestão acadêmica."
      intro="Fluxos para aulas, provas, extensão e colaboração entre docentes e alunos."
      highlights={[
        { title: "Aulas e avaliações", desc: "Agenda, gravações e provas com feedbacks." },
        { title: "Colaboração acadêmica", desc: "Compartilhamento seguro entre docentes e alunos." },
        { title: "Extensão e pesquisa", desc: "Espaços para projetos com parceiros e comunidades." },
      ]}
    />
  );
}
