import BrandingPage from "../../../components/BrandingPage";

export default function VioAnalyticsBranding() {
  return (
    <BrandingPage
      slug="vioanalytics"
      heroTitle="VioAnalytics: métricas e insights Vio/KnexIT"
      heroDescription="Monitore engajamento de aulas, lives e materiais com painéis unificados."
      featureCards={[
        { title: "Eventos consolidados", body: "Visualizações, participação e downloads em um só lugar." },
        { title: "Dashboards de engajamento", body: "KPIs por turma, curso, período e conteúdo." },
        { title: "Base para BI", body: "Exporte relatórios e alimente data warehouse externo." },
        { title: "Integrações planejadas", body: "Conecte VioClass, VioLive, SupaDrive e KnexAI." },
      ]}
      benefits={[
        "Visibilidade clara de uso e engajamento.",
        "Indicadores para decisões pedagógicas e operacionais.",
        "Preparação para integrações com BI corporativo.",
      ]}
    />
  );
}
