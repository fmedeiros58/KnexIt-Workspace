import SolutionLayout from "../_components/SolutionLayout";

export default function VisaoGeralIndividuosPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Visão geral - Individuais"
      subtitle="Workspace ajustado para uso pessoal e micro iniciativas."
      intro="Comece com o básico de colaboração, armazenamento e comunicação em um ambiente simples de configurar."
      highlights={[
        { title: "Organização simplificada", desc: "Arquivos, notas e comunicação em um único lugar com poucos cliques." },
        { title: "Fluxos prontos", desc: "Templates curtos para projetos pessoais, portfólios e estudos." },
        { title: "Privacidade e controle", desc: "Espaços privados, compartilhamento por link e rastreabilidade básica." },
      ]}
    />
  );
}
