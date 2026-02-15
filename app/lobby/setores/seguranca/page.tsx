import SectorLayout from "../_components/SectorLayout";

export default function SegurancaSetoresPage() {
  return (
    <SectorLayout
      title="Segurança"
      subtitle="Controles, auditoria e políticas para ambientes críticos."
      intro="Estruture políticas, trilhas de auditoria e runbooks de resposta, mantendo dados protegidos em todos os setores e departamentos."
      highlights={[
        { title: "Políticas e conformidade", desc: "Modelos de acesso, retenção e compartilhamento alinhados a normas internas." },
        { title: "Auditoria e alertas", desc: "Registros de atividades, revisões periódicas e notificações de uso sensível." },
        { title: "Resposta a incidentes", desc: "Runbooks, playbooks e comunicação coordenada entre equipes." },
      ]}
    />
  );
}
