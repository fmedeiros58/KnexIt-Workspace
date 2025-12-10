import DepartmentLayout from "../_components/DepartmentLayout";

export default function RecursosHumanosPage() {
  return (
    <DepartmentLayout
      title="Recursos Humanos"
      subtitle="Onboarding, políticas e desenvolvimento de pessoas."
      intro="Centralize templates de admissão, trilhas de integração e comunicações internas para todo o ciclo de gente."
      highlights={[
        { title: "Onboarding e offboarding", desc: "Checklists, acessos e comunicações padrão." },
        { title: "Políticas e documentos", desc: "Repositório versionado de políticas, benefícios e FAQs." },
        { title: "Desenvolvimento", desc: "Planos de carreira, feedbacks e trilhas de aprendizado." },
      ]}
    />
  );
}
