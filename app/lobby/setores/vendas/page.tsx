import DepartmentLayout from "../_components/DepartmentLayout";

export default function VendasPage() {
  return (
    <DepartmentLayout
      title="Vendas"
      subtitle="Playbooks comerciais e gestão de pipeline."
      intro="Padronize propostas, discovery, follow-ups e handoff com operações e sucesso do cliente."
      highlights={[
        { title: "Playbooks e scripts", desc: "Roteiros por ICP, objeções e materiais de apoio." },
        { title: "Pipeline e cadências", desc: "Modelos de cadência, checkpoints e templates de proposta." },
        { title: "Handoff e onboarding", desc: "Checklist de passagem para implementação e sucesso do cliente." },
      ]}
    />
  );
}
