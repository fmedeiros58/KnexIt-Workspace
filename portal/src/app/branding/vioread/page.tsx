import BrandingPage from "../../../components/BrandingPage";

export default function VioReadBranding() {
  return (
    <BrandingPage
      slug="vioread"
      heroTitle="VioRead: leitura assistida"
      heroDescription="Leitura inteligente de PDFs e artigos, com tradução e apoio de IA."
      featureCards={[
        { title: "Estrutura preservada", body: "Títulos, seções e listas intactas." },
        { title: "Tradução lado a lado", body: "Mantenha o formato ao mudar de idioma." },
        { title: "Análises com IA", body: "Explique, resuma ou fichar trechos selecionados." },
        { title: "Exportações", body: "Envie para KnexDocs, VioClass ou SupaDrive." },
      ]}
      benefits={[
        "Estudo mais rápido com apoio de IA.",
        "Menos esforço para fichamentos e resumos.",
        "Integração com outros produtos de conteúdo.",
      ]}
    />
  );
}
