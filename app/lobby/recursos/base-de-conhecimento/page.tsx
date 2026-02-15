import ResourceLayout from "../_components/ResourceLayout";

export default function BaseDeConhecimentoPage() {
  return (
    <ResourceLayout
      title="Base de conhecimento"
      subtitle="Artigos, vídeos e treinamentos rápidos."
      intro="Centralize how-to, vídeos curtos e respostas rápidas para reduzir dúvidas recorrentes e acelerar o onboarding."
      highlights={[
        { title: "Artigos rápidos", desc: "Passo a passo ilustrado para tarefas frequentes." },
        { title: "Vídeos curtos", desc: "Demonstrações diretas para usuários e times internos." },
        { title: "Coleções por tema", desc: "Agrupe conteúdos por produto, setor ou persona." },
      ]}
    />
  );
}
