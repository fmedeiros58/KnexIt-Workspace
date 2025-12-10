import SolutionLayout from "../_components/SolutionLayout";

export default function VisaoGeralEnterprisePage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Visão geral - Grandes empresas"
      subtitle="Escala, segurança e governança para operações amplas."
      intro="Inclui fluxos avançados, auditoria e integrações profundas com seus sistemas."
      highlights={[
        { title: "Governança centralizada", desc: "Perfis, unidades e controles para ambientes complexos." },
        { title: "Conformidade", desc: "Auditoria, trilhas e retenção alinhadas às políticas corporativas." },
        { title: "Integrações empresariais", desc: "SSO, SCIM e webhooks para conectar ERPs e sistemas legados." },
      ]}
    />
  );
}
