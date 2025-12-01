import BrandingPage from "../../supadrive/components/BrandingPage";

export default function SupaDriveBranding() {
  return (
    <BrandingPage
      slug="supadrive"
      heroTitle="SupaDrive: drive de arquivos para aulas, pesquisa e projetos"
      heroDescription="Organize apostilas, provas, slides e mídias com acesso por turma ou grupo."
      featureCards={[
        { title: "Pastas por turma/curso", body: "Estrutura clara com permissões configuráveis por grupo." },
        { title: "Visualização rápida", body: "PDFs, slides e mídias sem precisar baixar." },
        { title: "Versões e comentários", body: "Alinhe revisões e mantenha histórico básico." },
        { title: "Integrações planejadas", body: "VioRead e KnexReview para leitura assistida; VioLive para replays." },
      ]}
      benefits={[
        "Centralização de materiais acadêmicos e de pesquisa.",
        "Acesso controlado para turmas, coordenações e grupos.",
        "Publicação rápida de provas, apostilas e replays.",
      ]}
    />
  );
}

