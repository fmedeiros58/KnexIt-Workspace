import SectorLayout from "../_components/SectorLayout";

export default function VarejoPage() {
  return (
    <SectorLayout
      title="Varejo"
      subtitle="Operação, treinamento e comunicação para times de loja e backoffice."
      intro="Padronize campanhas, treinamentos e comunicação entre matriz e lojas, mantendo materiais atualizados e rastreáveis."
      highlights={[
        { title: "Playbooks de campanha", desc: "Materiais, prazos e checklists por loja ou região." },
        { title: "Comunicação ágil", desc: "Anúncios, manuais e FAQs para times de campo." },
        { title: "Treinamento de equipes", desc: "Trilhas rápidas para onboarding e novos produtos." },
      ]}
    />
  );
}
