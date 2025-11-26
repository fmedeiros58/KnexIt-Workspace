import BrandingPage from "../../knexdocs/components/BrandingPage";

export default function KnexDocsBranding() {
  return (
    <BrandingPage
      slug="knexdocs"
      heroTitle="KnexDocs: documentos colaborativos do ecossistema"
      heroDescription="Crie, edite e versionize docs em tempo real, integrando com SupaDrive, KnexAI e VioRead."
      featureCards={[
        { title: "Colaboração em tempo real", body: "Coedição com histórico e comentários." },
        { title: "Versões e permissões", body: "Controle de acesso e rastreabilidade." },
        { title: "Integração com arquivos e IA", body: "Fluxos planejados com SupaDrive, KnexAI e VioRead." },
        { title: "Templates prontos", body: "Atas, pautas, comunicados e formulários internos." },
      ]}
      benefits={[
        "Menos dispersão de documentos entre apps.",
        "Facilidade para times acadêmicos e operacionais.",
        "Base para colaboração com IA e outros produtos.",
      ]}
    />
  );
}

