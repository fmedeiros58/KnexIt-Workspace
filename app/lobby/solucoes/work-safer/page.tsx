import SolutionLayout from "../_components/SolutionLayout";

export default function WorkSaferPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Work Safer"
      subtitle="Segurança reforçada e governança."
      intro="Proteção avançada, auditoria e políticas detalhadas para grandes operações."
      highlights={[
        { title: "Proteção de dados", desc: "Classificação, retenção e alertas para uso indevido." },
        { title: "Acesso rigoroso", desc: "MFA, SSO e revisões periódicas de permissões." },
        { title: "Auditoria", desc: "Trilhas detalhadas e relatórios para compliance." },
      ]}
    />
  );
}
