import ResourceLayout from "../_components/ResourceLayout";

export default function EmBrevePage() {
  return (
    <ResourceLayout
      title="Em breve"
      subtitle="Conteúdo adicional está a caminho."
      intro="Novos guias, coleções e playbooks estão sendo preparados e serão liberados aqui."
      highlights={[
        { title: "Novos templates", desc: "Modelos avançados para operações e comunicação." },
        { title: "Séries de vídeos", desc: "Sequências de treinos curtos por persona." },
        { title: "Coleções curadas", desc: "Agrupamentos por setor e departamento." },
      ]}
    />
  );
}
