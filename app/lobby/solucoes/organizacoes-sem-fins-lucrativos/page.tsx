import SolutionLayout from "../_components/SolutionLayout";

export default function OrganizacoesSemFinsLucrativosPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Organizações sem fins lucrativos"
      subtitle="Ferramentas para impacto social e gestão eficiente."
      intro="Coordene voluntários, comunicações e documentação em um só lugar."
      highlights={[
        { title: "Gestão de voluntários", desc: "Escalas, comunicações e kits de onboarding." },
        { title: "Transparência", desc: "Documentos, prestações e campanhas acessíveis." },
        { title: "Captação", desc: "Fluxos para doações, recibos e follow-ups." },
      ]}
    />
  );
}
