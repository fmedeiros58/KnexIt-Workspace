import BrandingPage from "../../../components/BrandingPage";

export default function VioClassBranding() {
  return (
    <BrandingPage
      slug="vioclass"
      heroTitle="VioClass: cursos e trilhas de aulas"
      heroDescription="Organize trilhas, materiais e avaliações em um único lugar."
      featureCards={[
        { title: "Trilhas completas", body: "Vídeo, textos e materiais anexados." },
        { title: "Avaliações e progresso", body: "Acompanhe por turma e aluno." },
        { title: "Interação e comentários", body: "Espaços de feedback entre alunos e instrutores." },
        { title: "Relatórios", body: "Visão resumida para coordenação pedagógica." },
      ]}
      benefits={[
        "Centralização de aulas e materiais.",
        "Fluxo contínuo de ensino/aprendizado.",
        "Integração com lives, arquivos e IA (futuro).",
      ]}
    />
  );
}
