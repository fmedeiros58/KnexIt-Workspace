import BrandingPage from "../../knexsearch/components/BrandingPage";

export default function KnexSearchBranding() {
  return (
    <BrandingPage
      slug="knexsearch"
      heroTitle="KnexSearch: busca unificada"
      heroDescription="Encontre aulas, arquivos, docs e conversas em um só lugar, com IA para consultas melhores."
      featureCards={[
        { title: "Busca federada", body: "Planejada em Drive, Docs, aulas e chats." },
        { title: "Ranking híbrido", body: "Relevância semântica + palavras-chave." },
        { title: "Sugestões com IA", body: "Reformule consultas e refine resultados (futuro)." },
        { title: "Filtros e contexto", body: "Por origem, turma, curso e período." },
      ]}
      benefits={[
        "Menos tempo perdido procurando materiais.",
        "Resultados mais relevantes com contexto.",
        "Base para IA auxiliar em buscas complexas.",
      ]}
    />
  );
}

