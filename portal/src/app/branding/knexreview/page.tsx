import BrandingPage from "../../../components/BrandingPage";

export default function KnexReviewBranding() {
  return (
    <BrandingPage
      slug="knexreview"
      heroTitle="KnexReview: revisão sistemática"
      heroDescription="Buscas replicáveis, triagem e extração em um só fluxo."
      featureCards={[
        { title: "Estratégias booleanas", body: "Construa e registre buscas replicáveis." },
        { title: "Triagem dedicada", body: "Inclua/exclua com histórico e deduplicação." },
        { title: "Extração de dados", body: "Sumários para exportar para KnexDocs ou VioRead." },
        { title: "Adaptadores plugáveis", body: "Execução em múltiplas fontes planejada." },
      ]}
      benefits={[
        "Rigor metodológico na revisão.",
        "Menos trabalho manual de triagem/extração.",
        "Integração com leitura assistida e documentação.",
      ]}
    />
  );
}
