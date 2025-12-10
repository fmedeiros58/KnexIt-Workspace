import SolutionLayout from "../_components/SolutionLayout";

export default function NovasEmpresasPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Novas empresas"
      subtitle="Arranque rápido com fluxos pré-configurados."
      intro="Implemente projetos, tarefas e comunicação em poucos passos."
      highlights={[
        { title: "Começo rápido", desc: "Assistentes passo a passo para configurar os primeiros times." },
        { title: "Templates de operação", desc: "Campanhas, vendas e suporte com playbooks prontos." },
        { title: "Acompanhamento", desc: "Painéis iniciais para medir adoção e desempenho." },
      ]}
    />
  );
}
