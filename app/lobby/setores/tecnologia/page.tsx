import SectorLayout from "../_components/SectorLayout";

export default function TecnologiaPage() {
  return (
    <SectorLayout
      title="Tecnologia"
      subtitle="Documentação, produto e operações para times de TI e engenharia."
      intro="Centralize RFCs, playbooks de incidentes e cadências de produto para manter o time alinhado."
      highlights={[
        { title: "Produto e delivery", desc: "Roadmaps, RFCs e rituais de squad em um só lugar." },
        { title: "Operações e SRE", desc: "Runbooks, incidentes e checklists de mudança." },
        { title: "Onboarding técnico", desc: "Trilhas de ferramentas, ambientes e padrões de código." },
      ]}
    />
  );
}
