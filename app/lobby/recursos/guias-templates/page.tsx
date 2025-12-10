import ResourceLayout from "../_components/ResourceLayout";

export default function GuiasTemplatesPage() {
  return (
    <ResourceLayout
      title="Guias e templates"
      subtitle="Modelos prontos para acelerar aulas, fluxos e comunicação."
      intro="Comece rápido com guias editáveis para lançamentos, treinamentos, projetos e operações do dia a dia."
      highlights={[
        { title: "Aulas e eventos", desc: "Roteiros de aula, webinars e agendas prontas para personalizar." },
        { title: "Projetos e operações", desc: "Checklists de entrega, cronogramas e modelos de plano." },
        { title: "Comunicação", desc: "Templates de anúncios, atualizações e follow-ups para equipes." },
      ]}
    />
  );
}
