import SolutionLayout from "../_components/SolutionLayout";

export default function DesenvolvedoresPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Desenvolvedores"
      subtitle="Recursos para criar e integrar com o ecossistema."
      intro="APIs, webhooks e guias para construir experiências conectadas."
      highlights={[
        { title: "APIs unificadas", desc: "Endereços claros para conteúdo, usuários e eventos." },
        { title: "Webhooks e automações", desc: "Reaja a uploads, mensagens e matrículas em tempo real." },
        { title: "Ambiente de testes", desc: "Sandboxes e chaves separadas para desenvolvimento." },
      ]}
    />
  );
}
