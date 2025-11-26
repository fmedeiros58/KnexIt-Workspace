import BrandingPage from "../../../components/BrandingPage";

export default function KnexFlowBranding() {
  return (
    <BrandingPage
      slug="knexflow"
      heroTitle="KnexFlow: orquestração e automações"
      heroDescription="Modele gatilhos e ações integrando aulas, arquivos, IA e comunicação."
      featureCards={[
        { title: "Gatilhos e ações", body: "Automatize avisos, uploads, registros e integrações." },
        { title: "Quadros e fluxos", body: "Visualize tarefas em kanban e acompanhe execuções." },
        { title: "Integrações nativas", body: "Conecte VioClass, SupaDrive, KnexAI, KnexMail e mais." },
        { title: "Base para webhooks", body: "Prepare fluxos para integrações externas." },
      ]}
      benefits={[
        "Menos trabalho manual e retrabalho.",
        "Execução rastreável de automações.",
        "Flexibilidade para novos produtos e integrações.",
      ]}
    />
  );
}
