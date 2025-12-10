import SolutionLayout from "../_components/SolutionLayout";

export default function StartupsPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Startups"
      subtitle="Ferramentas enxutas para crescer rápido."
      intro="Automatize rotinas, organize conhecimento e ganhe velocidade nas entregas."
      highlights={[
        { title: "Iteração em ritmo", desc: "Documente experimentos e releases com checklists leves." },
        { title: "Automação", desc: "Gatilhos simples conectando ferramentas da stack de produto." },
        { title: "Visão do time", desc: "Roadmaps e betas compartilhados com stakeholders." },
      ]}
    />
  );
}
