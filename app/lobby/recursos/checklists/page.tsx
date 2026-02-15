import ResourceLayout from "../_components/ResourceLayout";

export default function ChecklistsPage() {
  return (
    <ResourceLayout
      title="Checklists"
      subtitle="Listas de verificação para equipes."
      intro="Modelos prontos para garantir consistência em lançamentos, aulas, eventos e operações diárias."
      highlights={[
        { title: "Lançamentos e campanhas", desc: "Checklist de pré, durante e pós-lançamento." },
        { title: "Eventos e aulas", desc: "Itens críticos para produção, transmissão e follow-up." },
        { title: "Operação contínua", desc: "Rotinas semanais e mensais para manter qualidade." },
      ]}
    />
  );
}
