import SolutionLayout from "../_components/SolutionLayout";

export default function EquipeAtendimentoPage() {
  return (
    <SolutionLayout
      badge="Soluções"
      title="Equipe de atendimento"
      subtitle="Fluxos dedicados para suporte e operações."
      intro="Roteie demandas, registre interações e mantenha o time alinhado."
      highlights={[
        { title: "Caixas de entrada", desc: "Triage de tickets, prioridades e responsáveis claros." },
        { title: "Base de atendimento", desc: "Macetes, respostas prontas e artigos num só lugar." },
        { title: "Qualidade", desc: "Métricas de SLA, CSAT e revisões de interações." },
      ]}
    />
  );
}
