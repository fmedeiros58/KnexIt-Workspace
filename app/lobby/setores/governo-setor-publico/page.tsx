import SectorLayout from "../_components/SectorLayout";

export default function GovernoSetorPublicoPage() {
  return (
    <SectorLayout
      title="Governo e setor público"
      subtitle="Transparência, documentação e serviços digitais."
      intro="Organize atos normativos, projetos e comunicação com cidadãos e equipes internas."
      highlights={[
        { title: "Documentos oficiais", desc: "Publicações, minutas e versões controladas." },
        { title: "Projetos e entregas", desc: "Planos, status e comunicação entre secretarias." },
        { title: "Serviços ao cidadão", desc: "Conteúdos orientativos e fluxos de atendimento." },
      ]}
    />
  );
}
