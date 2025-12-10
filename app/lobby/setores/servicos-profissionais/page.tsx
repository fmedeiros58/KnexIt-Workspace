import SectorLayout from "../_components/SectorLayout";

export default function ServicosProfissionaisPage() {
  return (
    <SectorLayout
      title="Serviços profissionais"
      subtitle="Entrega, contratos e conhecimento para consultorias e escritórios."
      intro="Concentre propostas, entregáveis e padrões de projeto com governança e histórico."
      highlights={[
        { title: "Playbooks de projeto", desc: "Modelos de kick-off, discovery e relatórios." },
        { title: "Controle de entregáveis", desc: "Versões, aprovações e comunicação com clientes." },
        { title: "Base de conhecimento", desc: "Casos, ativos reutilizáveis e lições aprendidas." },
      ]}
    />
  );
}
