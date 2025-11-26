import BrandingPage from "../../../components/BrandingPage";

export default function VioStudioBranding() {
  return (
    <BrandingPage
      slug="viostudio"
      heroTitle="VioStudio: edição e pós-produção online"
      heroDescription="Refine cortes, legendas e exports para aulas, lives e replays."
      featureCards={[
        { title: "Timeline simples", body: "Cortes, ajustes e montagem rápida no navegador." },
        { title: "Legendas e capítulos", body: "Marque trechos e publique com acessibilidade." },
        { title: "Exports prontos", body: "Envie para VioClass, SupaDrive ou compartilhamento externo." },
        { title: "Integrações futuras", body: "Automatize ingestão de VioRecord/VioLive e saída para aulas." },
      ]}
      benefits={[
        "Padronização de vídeos educacionais.",
        "Publicação rápida de replays e materiais complementares.",
        "Menos dependência de softwares locais de edição.",
      ]}
    />
  );
}
