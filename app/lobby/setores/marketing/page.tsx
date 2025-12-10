import DepartmentLayout from "../_components/DepartmentLayout";

export default function MarketingPage() {
  return (
    <DepartmentLayout
      title="Marketing"
      subtitle="Campanhas, conteúdo e eventos em um só lugar."
      intro="Organize pautas, assets e checklists de execução com visibilidade para times e parceiros."
      highlights={[
        { title: "Planejamento de campanhas", desc: "Briefings, cronogramas e aprovações centralizados." },
        { title: "Conteúdo e assets", desc: "Repositório de peças, versões e guidelines de marca." },
        { title: "Eventos e webinars", desc: "Modelos de landing, roteiros e pós-evento." },
      ]}
    />
  );
}
