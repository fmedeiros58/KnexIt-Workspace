import BrandingPage from "../../../components/BrandingPage";

export default function KnexAiBranding() {
  return (
    <BrandingPage
      slug="knexai"
      heroTitle="KnexAI: camada unificada de IA"
      heroDescription="Assistentes, leitura e busca conectados aos seus dados, com streaming e governança."
      featureCards={[
        { title: "Assistentes configuráveis", body: "Contexto de aulas, arquivos e pesquisas." },
        { title: "Streaming e prompts", body: "Endpoint /api/knexai com resposta incremental." },
        { title: "Limites por plano", body: "Governança alinhada ao Workspace." },
        { title: "Integrações", body: "Pontos com VioRead, KnexReview e KnexSearch." },
      ]}
      benefits={[
        "IA centralizada, sem dispersão de contextos.",
        "Conexão com dados relevantes do ecossistema.",
        "Configuração consistente de políticas e limites.",
      ]}
    />
  );
}
