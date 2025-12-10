import SolutionLayout from "../_components/SolutionLayout";

export default function PequenasEmpresasPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Pequenas empresas"
      subtitle="Produtividade e colaboração para times menores."
      intro="Modelos prontos, armazenamento seguro e comunicação integrada."
      highlights={[
        { title: "Modelos prontos", desc: "Projetos, tarefas e comunicações em formatos predefinidos." },
        { title: "Colaboração simples", desc: "Comentários, menções e arquivos com permissões claras." },
        { title: "Crescimento previsível", desc: "Rotinas e cadências para times pequenos ganharem escala." },
      ]}
    />
  );
}
