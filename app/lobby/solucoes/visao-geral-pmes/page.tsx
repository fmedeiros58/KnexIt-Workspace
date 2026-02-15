import SolutionLayout from "../_components/SolutionLayout";

export default function VisaoGeralPmesPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Visão geral - PMEs"
      subtitle="Produtividade e organização para pequenas e médias empresas."
      intro="Combine arquivos, comunicação e fluxos para equipes enxutas com governança leve."
      highlights={[
        { title: "Quadros de time", desc: "Pastas e coleções por área, com permissões simples." },
        { title: "Fluxos repetitivos", desc: "Checklists para on/offboarding, marketing e operações." },
        { title: "Relatórios rápidos", desc: "Visões semanais de entregas e andamento dos projetos." },
      ]}
    />
  );
}
