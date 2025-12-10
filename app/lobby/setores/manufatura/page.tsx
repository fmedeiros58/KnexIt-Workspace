import SectorLayout from "../_components/SectorLayout";

export default function ManufaturaPage() {
  return (
    <SectorLayout
      title="Manufatura"
      subtitle="Documentação, qualidade e treinamentos para chão de fábrica."
      intro="Centralize instruções de trabalho, controles de qualidade e planos de manutenção com rastreabilidade."
      highlights={[
        { title: "Instruções e SOPs", desc: "Versões controladas de procedimentos e checklists operacionais." },
        { title: "Qualidade e segurança", desc: "Registros de inspeção, incidentes e auditorias." },
        { title: "Treinamento por função", desc: "Trilhas para operadores, manutenção e liderança." },
      ]}
    />
  );
}
