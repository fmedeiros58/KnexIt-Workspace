import SectorLayout from "../_components/SectorLayout";

export default function SaudeCienciasBiologicasPage() {
  return (
    <SectorLayout
      title="Saúde e ciências biológicas"
      subtitle="Fluxos para ensino, pesquisa e operações clínicas."
      intro="Organize aulas, laboratórios, prontuários e trilhas de capacitação com governança de dados sensíveis."
      highlights={[
        { title: "Colaboração acadêmica", desc: "Repositórios de artigos, protocolos e materiais de aula." },
        { title: "Segurança e compliance", desc: "Controles de acesso, auditoria e retenção para dados clínicos." },
        { title: "Treinamento contínuo", desc: "Checklists, avaliações e certificações para equipes de saúde." },
      ]}
    />
  );
}
