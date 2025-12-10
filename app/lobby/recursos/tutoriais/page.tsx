import ResourceLayout from "../_components/ResourceLayout";

export default function TutoriaisPage() {
  return (
    <ResourceLayout
      title="Tutoriais"
      subtitle="Passo a passo rápido para começar."
      intro="Tutoriais curtos e práticos para configurar, publicar e operar sem fricção."
      highlights={[
        { title: "Primeiros passos", desc: "Crie espaços, convide pessoas e organize permissões." },
        { title: "Publicar e compartilhar", desc: "Upload, organização e compartilhamento seguro de materiais." },
        { title: "Automação básica", desc: "Ative integrações e gatilhos simples para ganhar tempo." },
      ]}
    />
  );
}
